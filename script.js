$(function() {
  const client = stitch.Stitch.initializeDefaultAppClient("patentreader-ticse");
  const db = client
    .getServiceClient(stitch.RemoteMongoClient.factory, "mongodb-atlas")
    .db("Patents");  

  var patentsJSON;
  var paused = true;
  var options = {
    colorCode: true,
    drawBorders: true,
    showNames: true,
    showBackgroundMap: true
  };

  initialize();
  
  function initialize(){
    const startingTownship = "022N - 002W";
    prepareHTML(startingTownship);
    AuthorizeAndFetchData(startingTownship);
  }
  
  function prepareHTML(startingTownship) {
    generateTwpSelectors();
    $("#drawColors").change(toggleColors);
    $("#drawBorders").change(toggleBorders);
    $("#showNames").change(toggleNames);
    $("#showBackground").change(toggleBackground);
    $("#townshipButton").click(toggleTwpSelector);
    $(".platTitle").click(revertFromPrinterFriendly);
    $("#animate").click(animateMap);
    $("#dateRange").on("input", function() {
      changeCurrentDate(this.value);
    });
    $("#printMap").click(function() {
      makePrinterFriendly("map");
    });
    $("#printIndex").click(function() {
      makePrinterFriendly("index");
    });
    $("#printBoth").click(function() {
      makePrinterFriendly("both");
    });
    $("#tableSearch,#tableSearchSec").keyup(searchIndex);
    $("#nameHeader").click(sortIndexByNames);
    $("#dateHeader").click(sortIndexByDate);
    $("#sectionHeader").click(sortIndexBySection);
    $(".close").click(toggleModal);
    $(window).click(function(event) {
      if (!event.target.matches(".dropbtn"))
        $("#selector").hide();
    });

    function generateTwpSelectors() {
      var selector = $("#selector");
      var townships = getTownshipList();
      for (var i = 0; i < townships.length; i++) {
        $(selector).append(
          "<div class='selectorSq' id='selector" +
            townships[i].replace(" - ", "") +
            "' data-township='" +
            townships[i] +
            "'><p>" +
            townships[i].replace(/0/g, "") +
            "</p></div>"
        );
        $("#selector" + townships[i].replace(" - ", "")).click(function() {
          selectNewTownship($(this).attr("data-township"));
        });
      }
      $("#selector" + startingTownship.replace(" - ","")).addClass("selectorSqSelected");
    }

    function getTownshipList() {
      var townships = [];
      for (var i = 25; i > 20; i--) {
        for (var r = 4; r > 0; r--)
          townships.push("0" + i + "N - 00" + r + "W");
        townships.push("0" + i + "N - 00" + 1 + "E");
      }
      return townships;
    }
  }

  function AuthorizeAndFetchData(twp) {
    client.auth
      .loginWithCredential(new stitch.AnonymousCredential())
      .then(() => fetchData(twp))
      .catch(err => {
        console.error(err);
      });
  }

  function fetchData(twp) {
    db
      .collection("wildcat_area")
      .find({ Twp_Rng: twp }, { limit: 1000 })
      .asArray()
      .then(docs => {
        patentsJSON = docs;
        platTownship();
      })
      .catch(err => {
        console.error(err);
      });
  }

  function platTownship() {
    cleanUpData(patentsJSON);
    generateBlankTownship();
    initializeMap();
    initializeSlider();
    populateIndex();
  }

  function cleanUpData(patents) {
    var toRemove = [];
    var cutoffDate = new Date(1900, 1, 1);
    for (var i = 0; i < patents.length; i++) {
      if (parseDate(patents[i]["Date"]) > cutoffDate) toRemove.push(patents[i]);
    }
    for (var r = 0; r < toRemove.length; r++) {
      console.log("removed patent: " + toRemove[r]);
      patents.splice(patents.indexOf(toRemove[r]), 1);
    }
  }

  function parseDate(str) {
    //m/d/yyyy
    if (str != null) {
      splt = str.split("/");
      return new Date(splt[2], splt[0], splt[1]);
    }
  }

  function generateBlankTownship() {
    $(".township").empty();
    for (var i = 6; i > 0; i--) {
      generateSection(i);
    }
    for (var i = 7; i < 13; i++) {
      generateSection(i);
    }
    for (var i = 18; i > 12; i--) {
      generateSection(i);
    }
    for (var i = 19; i < 25; i++) {
      generateSection(i);
    }
    for (var i = 30; i > 24; i--) {
      generateSection(i);
    }
    for (var i = 31; i < 37; i++) {
      generateSection(i);
    }
  }

  function generateSection(secNum) {
    var secName = "sec" + secNum.toString();
    $(".township").append("<div class='section " + secName + "'></div>");
    $("." + secName).append(
      "<p class='secLabel'>" +
        (secNum.toString().length > 1 ? secNum : "0" + secNum) +
        "</p>" +
        "<div class='quarter n w'></div>" +
        "<div class='quarter n e'></div>" +
        "<div class='quarter s w'></div>" +
        "<div class='quarter s e'></div>"
    );
    $("." + secName)
      .find("div.quarter")
      .append(
        "<div class='sq n w' ><p></p></div>" +
          "<div class='sq n e' ><p></p></div>" +
          "<div class='sq s w' '><p></p></div>" +
          "<div class='sq s e' '><p></p></div>"
      );
  }

  function initializeMap() {
    var names = getUniquePatentNames(patentsJSON);
    assignPlats(patentsJSON, names);
    drawBorders();
    labelPlats(names);
    colorPlats();
    onlyShowUpToDate("12/2/1830");
    assignBackground();
    assignOptionFilters();
    $(".sq").click(function() {
      toggleModal(this);
    });
  }

  function getUniquePatentNames(patents) {
    var names = patents.map(function(pt) {
      return pt["Names"];
    });

    var uniqueNames = [];
    $.each(names, function(i, el) {
      if ($.inArray(el, uniqueNames) === -1) uniqueNames.push(el);
    });
    return uniqueNames;
  }

  function assignPlats(patents, names) {
    patents.forEach(function(pat) {
      assignSquares(pat);
    });
  }

  function assignSquares(pat) {
    var secNum = pat["Sec"];
    var quot = pat["Aliquots"];
    var dirs = quot ? parseAliquot(quot) : null;

    //If quot empty, it is a full section.
    if (quot == null || quot == "") {
      var sqs = $("div.section.sec" + secNum).find("div.sq");
      mapPatentToSquares(pat, sqs);

      //If only one letter-group, either a quarter or 2 quarters (half)
    } else if (!dirs[1]) {
      var sqs = $("div.section.sec" + secNum)
        .find("div.quarter" + dirToClass(dirs[0]))
        .find("div");
      mapPatentToSquares(pat, sqs);

      //Otherwise, we're dealing with fragments in squares
    } else {
      var sqs = $("div.section.sec" + secNum)
        .find("div.quarter" + dirToClass(dirs[1]))
        .find("div.sq" + dirToClass(dirs[0]));
      mapPatentToSquares(pat, sqs);
    }
  }

  function mapPatentToSquares(pat, sqs) {
    for (var i = 0; i < sqs.length; i++) {
      flagIfConflicted(sqs[i], pat);
      mapPatentIfOlder(sqs[i], pat);
    }
  }

  function flagIfConflicted(square, patent) {
    if ($(square).attr("data-date") != undefined) {
      $(square).addClass("conflict");
      patent.Conflict = true;
      patentsJSON.find(function(patent) {
        return patent._id == $(square).attr("data-patentid");
      }).Conflict = true;
    }
  }

  function mapPatentIfOlder(square, patent) {
    //If there is a conflict, only map if this patent is older
    if (
      $(square).attr("data-date") == undefined ||
      parseDate($(square).attr("data-date")) > parseDate(patent.Date)
    )
      $(square)
        .attr("data-name", patent.Names)
        .attr("data-patentID", patent._id)
        .attr("data-date", patent.Date)
        .attr("title", patent.Names + "\n" + patent.Date);
  }

  function parseAliquot(quot) {
    //Assuming correct input, which is stupid
    //Get first cardinal direction (fraction unneeded - 2 letters = quarter, 1 = half)
    var dir1 = quot
      .slice(0, 2)
      .match(/[A-Z]/g)
      .join("")
      .toLowerCase();
    var dir2 =
      quot.length > 3
        ? quot
            .slice(2)
            .match(/[A-Z]/g)
            .join("")
            .toLowerCase()
        : null;

    //Check for unconventional "SE quarter of N half" construction (SE¼N½) and convert if used
    //First scenario N/S: SE of N is actually 'S of NE'; Second E/W: SE of W is actullay 'E of SW'
    if (dir2 && dir1.length > 1 && dir2.length == 1) {
      if (dir2.toUpperCase() == "N" || dir2.toUpperCase() == "S") {
        var newDir1 = dir1.slice(0, 1);
        var newDir2 = dir2 + dir1.slice(1);
        dir1 = newDir1;
        dir2 = newDir2;
      } else {
        var newDir1 = dir1.slice(1);
        var newDir2 = dir1.slice(0, 1) + dir2;
        dir1 = newDir1;
        dir2 = newDir2;
      }
    } else if (dir2 && dir2.length > 2) {
      //Deal with any extra info in second portion of aliquot
      //get ride of any "lot/trc 1" stuff
      var newDir2 = dir2
        .split("¼")[0]
        .split("½")[0]
        .match(/[n|s|w|e]/g)
        .join("");
      dir2 = newDir2;

      //Check for unconventional jackassery of the type "S½W½SW¼" instead of (SW SW)
      if (newDir2.length > 2) {
        var finalDir1 = dir1 + dir2.slice(0, 1);
        var finalDir2 = newDir2.slice(1);
        dir1 = finalDir2;
        dir2 = finalDir2;
      }
    }

    return [dir1, dir2];
  }

  function dirToClass(dir) {
    return dir.length > 1 ? "." + dir[0] + "." + dir[1] : "." + dir;
  }

  function labelPlats(names) {
    idPlatGroups();

    //For each section...
    for (var i = 1; i < 37; i++) {
      //for each possibly plat id
      for (var r = 0; r < 16; r++) {
        //Label the first square of that plat
        var sqs = $("div.sec" + i).find("div.sq[data-platid='" + r + "']");
        if (sqs.length > 0) {
          var name = $(sqs[0]).attr("data-name");
          if (name != undefined)
            $(sqs[0])
              .find("p")
              .text(name.split(",")[0]);
        }
      }
    }

    $(".platTitle").text("Township: " + patentsJSON[0]["Twp_Rng"]);
  }

  function idPlatGroups() {
    //for each section...
    for (var i = 1; i < 37; i++) {
      var platIDMaker = 0;
      var squares = $("div.sec" + i).find(".sq");
      var secMatrix = getSectionMatrix(squares);

      //ID plat groups
      for (var r = 0; r < squares.length; r++) {
        var platID = $(squares[r]).attr("data-platid");
        if (platID == undefined) {
          var touchingSquares = getTouchingSquares(squares[r], secMatrix);
          var matchingSquares = touchingSquares.filter(function(sq) {
            return $(sq).attr("data-name") == $(squares[r]).attr("data-name");
          });
          if (matchingSquares.length > 0) {
            var squaresWithPlatID = matchingSquares.filter(function(sq) {
              return $(sq).attr("data-platid") != undefined;
            });
            if (squaresWithPlatID.length > 0)
              $(squares[r]).attr(
                "data-platid",
                $(squaresWithPlatID[0]).attr("data-platid")
              );
            else {
              $(squares[r]).attr("data-platid", platIDMaker);
              platIDMaker += 1;
            }
          } else {
            $(squares[r]).attr("data-platid", platIDMaker);
            platIDMaker += 1;
          }
        }
      }
    }
  }

  function getSectionMatrix(squares) {
    var secMatrix = [
      [squares[0], squares[1], squares[4], squares[5]],
      [squares[2], squares[3], squares[6], squares[7]],
      [squares[8], squares[9], squares[12], squares[13]],
      [squares[10], squares[11], squares[14], squares[15]]
    ];

    return secMatrix;
  }

  function getXY(val, arr) {
    var y = null;
    var x = null;
    if (arr)
      for (var i = 0; i < arr.length; i++) {
        for (var r = 0; r < arr[i].length; r++) {
          if (arr[i][r] === val) {
            y = i;
            x = r;
          }
        }
      }

    return y != null ? { x: x, y: y } : null;
  }

  function getNextTo(val, matr, direction) {
    var valXY = getXY(val, matr);
    var nextTo;

    if (valXY != null && valXY != undefined) {
      if (direction == "up" && valXY.y > 0) nextTo = matr[valXY.y - 1][valXY.x];
      else if (direction == "down" && valXY.y < 3)
        nextTo = matr[valXY.y + 1][valXY.x];
      else if (direction == "left" && valXY.x > 0)
        nextTo = matr[valXY.y][valXY.x - 1];
      else if (direction == "right" && valXY.x < 3)
        nextTo = matr[valXY.y][valXY.x + 1];
    }

    return nextTo != undefined ? nextTo : null;
  }

  function getTouchingSquares(sq, matr) {
    var touchingSquares = [];
    if (matr != null && matr != undefined) {
      touchingSquares.push(getNextTo(sq, matr, "left"));
      touchingSquares.push(getNextTo(sq, matr, "right"));
      touchingSquares.push(getNextTo(sq, matr, "up"));
      touchingSquares.push(getNextTo(sq, matr, "down"));
    }

    return touchingSquares.filter(function(v) {
      return v != null;
    });
  }

  function drawBorders() {
    //Sqs that need left border checked
    var sqLeft = [1, 4, 5, 3, 6, 7, 9, 12, 13, 11, 14, 15];
    //Sqs on left to check
    var sqRight = [0, 1, 4, 2, 3, 6, 8, 9, 12, 10, 11, 14];
    var sqTop = [2, 3, 6, 7, 8, 9, 12, 13, 10, 11, 14, 15];
    var sqBottom = [0, 1, 4, 5, 2, 3, 6, 7, 8, 9, 12, 13];
    //For every section
    for (var i = 1; i < 37; i++) {
      var squares = $("div.sec" + i).find("div.sq");
      for (var r = 0; r < sqLeft.length; r++) {
        addBorderIfNotEqual(squares[sqLeft[r]], squares[sqRight[r]], "left");
        addBorderIfNotEqual(squares[sqRight[r]], squares[sqLeft[r]], "right");
        addBorderIfNotEqual(squares[sqTop[r]], squares[sqBottom[r]], "top");
        addBorderIfNotEqual(squares[sqBottom[r]], squares[sqTop[r]], "bottom");
      }
    }
  }

  function addBorderIfNotEqual(square1, square2, border) {
    if ($(square1).attr("data-name") != $(square2).attr("data-name"))
      $(square1).addClass("boundary_" + border);
  }

  function colorPlats() {
    var names = getUniquePatentNames(patentsJSON);
    var colors = [];

    for (var i = 0; i < names.length; i++) {
      var color = selectColor(i, names.length);
      colors.push(color);
    }

    var squares = $("div.sq");
    for (var r = 0; r < squares.length; r++) {
      $(squares[r]).css(
        "background-color",
        colors[names.indexOf($(squares[r]).attr("data-name"))]
      );
    }
  }

  function selectColor(colorNum, colors) {
    if (colors < 1) colors = 1; // defaults to one color - avoid divide by zero
    return "hsla(" + (colorNum * (360 / colors)) % 360 + ",70%,50%,0.5)";
  }

  function onlyShowUpToDate(dateStr) {
    //var date = parseDate(dateStr);
    var date = new Date(parseInt(dateStr));
    var sqrs = $("div.sq");

    for (var i = 0; i < sqrs.length; i++) {
      var dateAttr = $(sqrs[i]).attr("data-date");
      var sqrDate = dateAttr ? parseDate(dateAttr) : null;

      if (sqrDate == null) $(sqrs[i]).addClass("timeFilter");
      else if (sqrDate > date) $(sqrs[i]).addClass("timeFilter");
      else $(sqrs[i]).removeClass("timeFilter");
    }
  }

  function assignBackground() {
    var baseURL =
      "./img/";
    var twpFilename =
      patentsJSON[0].Twp_Rng.replace(" - ", "").toLowerCase() + ".png";

    $(".township").css(
      "background-image",
      "url(" + baseURL + "twp/" + twpFilename + ")"
    );
    $("#downloadLink").attr(
      "href",
      baseURL + "generated/overlay/" + twpFilename
    );
  }

  function assignOptionFilters() {
    if (!options.colorCode) hideColors();
    if (!options.drawBorders) removeBorders();
    if (!options.showNames) hideNames();
    if (!options.showBackgroundMap) hideBackground();
  }

  function hideColors() {
    $("div.sq").addClass("sqNoColor");
  }

  function removeBorders() {
    $(".sq").removeClass(
      "boundary_left boundary_right boundary_top boundary_bottom"
    );
  }

  function hideNames() {
    $(".sq p").hide();
  }

  function hideBackground() {
    $(".township").addClass("noBackground");
  }

  function selectNewTownship(twp) {
    $(".selectorSq").removeClass("selectorSqSelected");
    $("#selector" + twp.replace(" - ", "")).addClass("selectorSqSelected");

    fetchData(twp);
  }

  function initializeSlider() {
    var dates = getUniquePatentDates(patentsJSON);
    var smallest = dates[0];
    var largest = dates[dates.length - 1];
    $("#dateRange")
      .attr("min", smallest.getTime() - 86400000)
      .attr("max", largest.getTime())
      .val(largest.getTime());
    updateDateDisplay(largest.getTime());
  }

  function getUniquePatentDates(patents) {
    var dates = patents.map(function(pt) {
      return pt["Date"];
    });

    var uniqueDates = [];
    var uniqueDatesParsed = [];
    $.each(dates, function(i, el) {
      if ($.inArray(el, uniqueDates) === -1) {
        uniqueDates.push(el);
        uniqueDatesParsed.push(parseDate(el));
      }
    });

    var orderedDates = uniqueDatesParsed.sort(function(a, b) {
      return a - b;
    });
    return orderedDates;
  }

  function updateDateDisplay(val) {
    var displayDate = new Date(parseInt(val));
    $("#dateDisplay").text(displayDate.toDateString());
  }

  function populateIndex() {
    var index = $(".index table")[0];
    $(index)
      .find("td")
      .remove();
    patentsJSON.forEach(function(pat) {
      var recordURL = getPatURL(pat);
      var searchURL = getSearchURL(pat);
      var conflictClass = pat.Conflict ? "conflict" : "";

      $(index).append(
        "<tr class='" +
          conflictClass +
          "' data-patentid='" +
          pat._id +
          "' >" +
          "<td>" +
          "<a title='Click to get full GLO record' href='" +
          recordURL +
          "'>" +
          pat.Accession +
          "</a></td>" +
          "<td>" +
          "<a title='Click to search IARA' href='" +
          searchURL +
          "' >" +
          pat.Names +
          "</a></td>" +
          "<td>" +
          pat.Date +
          "</td>" +
          "<td>" +
          pat.Twp_Rng +
          "</td>" +
          "<td class='clickable tableAliquot' title='Click to highlight plat'>" +
          pat.Aliquots +
          "</td>" +
          "<td>" +
          pat.Sec +
          "</td>" +
          "<td>" +
          pat.County +
          "</td>" +
          "</tr>"
      );
    });
    assignTableEvents();
  }

  function getPatURL(pat) {
    var acession = pat["Accession"];
    var type = acession.slice(0, 2);
    var recordURL;
    if (type == "IN")
      recordURL =
        "https://glorecords.blm.gov/details/patent/default.aspx?accession=" +
        pat["Accession"] +
        "&docClass=STA&sid=lhmgzytp.lnq";
    else
      recordURL =
        "https://glorecords.blm.gov/details/patent/default.aspx?accession=" +
        acession.slice(3) +
        "&docClass=MW&sid=c1wx5usw.c0w";

    return recordURL;
  }

  function getSearchURL(pat) {
    var names = pat.Names;
    return (
      "https://secure.in.gov/apps/iara/search/Home/Search?searchNow=True&defaultCollectionId=&RecordSeriesId=4&Keywords=&County=All&SeriesCollectionId=10&PhotographTitle=&PhotographSubject=&FirstName=" +
      names
        .split(";")[0]
        .split(",")[1]
        .trim() +
      "&LastName=" +
      names
        .split(";")[0]
        .split(",")[0]
        .trim() +
      "&CourtType=&CourtDisposition=&StartDate=0&EndDate=0&UseSoundex=false"
    );
  }

  function assignTableEvents() {
    $("tr").mouseenter(function() {
      var patID = $(this).attr("data-patentid");
      if (patID) highlightPatentPlat(patID);
    });
    $("tr").mouseleave(function() {
      var patID = $(this).attr("data-patentid");
      if (patID) unHighlightPatentPlat(patID);
    });
    $(".tableAliquot").click(function() {
      var patID = $(this)
        .parent()
        .attr("data-patentid");
      togglePatentHighlight(patID);
    });
  }

  function highlightPatentPlat(patID) {
    $(".sq[data-patentid='" + patID + "']").addClass("sqSelected");
  }

  function unHighlightPatentPlat(patID) {
    $(".sq[data-patentid='" + patID + "']").removeClass("sqSelected");
  }

  //********* Event Handlers *************

  //Display Options

  function toggleNames() {
    $(".sq p").toggle();
    options.showNames = this.checked;
  }

  function toggleBorders() {
    var showBorders = this.checked;
    options.drawBorders = showBorders;
    if (showBorders) drawBorders();
    else removeBorders();
  }

  function toggleColors() {
    var showColors = this.checked;
    options.colorCode = showColors;
    if (showColors) revealColors();
    else hideColors();
  }

  function revealColors() {
    $("div.sq").removeClass("sqNoColor");
  }

  function toggleBackground() {
    options.showBackgroundMap = this.checked;
    $(".township").toggleClass("noBackground");
  }

  //Etc.

  function changeCurrentDate(val) {
    updateDateDisplay(val);
    onlyShowUpToDate(val);
    $("#dateRange").val(val);
  }

  function toggleModal(sq) {
    if ($(".modal").css("display") == "none")
      updateModal(sq.getAttribute("data-patentid"));

    $(".modal").toggle();
  }

  function updateModal(patID) {
    if (patID != null) {
      var patent = patentsJSON.find(obj => {
        return obj._id == patID;
      });

      var names = patent["Names"];
      var datePurchased = patent["Date"];
      var aliquots =
        (patent["Aliquots"].length > 0 ? patent["Aliquots"] : "All") +
        " of Section " +
        patent["Sec"] +
        " of Township " +
        patent["Twp_Rng"] +
        (patent.Conflict
          ? " [CONFLICT: Another patent conflicts with this one. This may be due to transcription error. See index.] "
          : "");
      var recordURL = getPatURL(patent);
      var searchURL = getSearchURL(patent);

      $(".modalNames").text(names);
      $(".modalDate").text(datePurchased);
      $(".modalAliquots").text(aliquots);

      $(".modalLink")
        .attr("href", recordURL)
        .text("Accession " + patent["Accession"]);
      $(".modalSearchLink")
        .attr("href", searchURL)
        .text("Click to search.");
    } else {
      $(
        ".modalNames, .modalDate, .modalAliquots, .modalLink, .modalSearchLink"
      ).text("N/A");
      $(".modalLink, .modalSearchLink").attr("href", "#");
    }
  }

  function animateMap() {
    var slider = $("#dateRange");
    var animateButton = $("#animate");

    if (paused) {
      if (slider.val() == slider.attr("max"))
        changeCurrentDate(slider.attr("min"));
      paused = false;
      $("#animate").text("Pause");
      var id = setInterval(frame, 5);
    } else {
      paused = true;
      animateButton.text("Animate");
    }

    function frame() {
      var currentVal = slider.val();
      var maxVal = slider.attr("max");
      var timeJumpMs = 94800000;

      if (currentVal == maxVal || paused) {
        animateButton.text("Animate");
        clearInterval(id);
      } else {
        var newVal = parseInt(currentVal) + timeJumpMs;
        changeCurrentDate(newVal);
      }
    }
  }

  function toggleTwpSelector() {
    $("#selector").toggle();
  }

  function sortIndexByDate() {
    var firstGreater =
      parseDate(patentsJSON[0].Date) >=
      parseDate(patentsJSON[patentsJSON.length - 1].Date)
        ? true
        : false;

    patentsJSON.sort(function(a, b) {
      return firstGreater
        ? parseDate(a.Date) - parseDate(b.Date)
        : parseDate(b.Date) - parseDate(a.Date);
    });

    populateIndex();
  }

  function sortIndexByNames() {
    var firstGreater =
      patentsJSON[0].Names.toLowerCase() >=
      patentsJSON[patentsJSON.length - 1].Names.toLowerCase()
        ? true
        : false;

    patentsJSON.sort(function(a, b) {
      var x = a.Names.toLowerCase();
      var y = b.Names.toLowerCase();
      if (x < y) {
        return firstGreater ? -1 : 1;
      }
      if (x > y) {
        return firstGreater ? 1 : -1;
      }
      return 0;
    });

    populateIndex();
  }

  function sortIndexBySection() {
    var firstGreater =
      parseInt(patentsJSON[0].Sec) >=
      parseInt(patentsJSON[patentsJSON.length - 1].Sec)
        ? true
        : false;

    patentsJSON.sort(function(a, b) {
      return firstGreater
        ? parseInt(a.Sec) - parseInt(b.Sec)
        : parseInt(b.Sec) - parseInt(a.Sec);
    });

    populateIndex();
  }

  function searchIndex() {
    // Declare variables
    var input,
      inputSec,
      filter,
      filterSec,
      table,
      tr,
      td,
      tdSec,
      i,
      txtValue,
      txtValueSec;
    input = document.getElementById("tableSearch");
    inputSec = document.getElementById("tableSearchSec");
    filter = input.value.toUpperCase();
    filterSec = inputSec.value;
    table = document.getElementById("indexTable");
    tr = table.getElementsByTagName("tr");

    // Loop through all table rows, and hide those who don't match the search query
    for (i = 0; i < tr.length; i++) {
      td = tr[i].getElementsByTagName("td")[1];
      tdSec = tr[i].getElementsByTagName("td")[5];
      if (td) {
        txtValue = td.textContent || td.innerText;
        txtValueSec = tdSec.textContent || tdSec.innerText;
        if (
          txtValue.toUpperCase().indexOf(filter) == 0 &&
          (txtValueSec == filterSec || filterSec == "")
        ) {
          tr[i].style.display = "";
          $(
            ".sq[data-patentid='" + $(tr[i]).attr("data-patentid") + "']"
          ).removeClass("indexFilter");
        } else {
          tr[i].style.display = "none";
          $(
            ".sq[data-patentid='" + $(tr[i]).attr("data-patentid") + "']"
          ).addClass("indexFilter");
        }
      }
    }
  }

  function togglePatentHighlight(patID) {
    $(".sq[data-patentid='" + patID + "']").toggleClass("sqSelectedSticky");
    $("tr[data-patentid='" + patID + "']").toggleClass("sqSelectedSticky");
  }

  function makePrinterFriendly(opt) {
    $(".controls").hide();
    $("body").addClass("printerFriendly");
    if (opt == "map") $(".index").hide();
    else if (opt == "index") $(".township, .platHeader p").hide();
  }

  function revertFromPrinterFriendly() {
    $(".controls, .index, .township, .platHeader p").show();
    $("body").removeClass("printerFriendly");
  }
});