# patent-platter
Interprets and maps aliquots of land patents in the Public Land Survey System

This takes historical data on federal land patents from the Bureau of Land Management Office to map the original purchasers of land. It also allows you to filter by year and see how the purchasing of land progressed over time.

See a live version here: https://codepen.io/brsloan/full/LaEqLe

<h2>Data Model</h2>
In this example, I have taken data from their website for a particular region of Indiana and put it in my own database with this form (random example given):

<ul>
  <li>Accession: "IN1040__.020"</li>
  <li>Names: "ASHTON, ELIAKIM"</li>
  <li>Date: "11/1/1830"</li>
  <li>Doc: "8334"</li>
  <li>Twp_Rng: "022N - 001W"</li>
  <li>Aliquots: "E½SE¼"</li>
  <li>Sec: "25"</li>
  <li>County: "Clinton"</li>
</ul>

This tells us that Eliakim Ashton bought the eastern half of the southeastern quarter of section 25 of township 22 North, range 1 West. (For more on this Public Land Survey System, see here: https://en.wikipedia.org/wiki/Public_Land_Survey_System)

<h2>How It Works</h2>

It interprets the aliquots to divide a grid of HTML divs into the appropriate plats and color/label them accordingly.

<h2>How It Needs Improved</h2>
  
 This is a messy system that does not separate logic and display very well, and since it is just a bunch of HTML divs you can't easily generate image files to download on the fly. Currently the "Download Map" link just goes to a subdirectory where, if I had uploaded them, would be a collection of premade image files corresponding to the different townships which I had made by printscreening the page. Not good. To fix this, I have created a separate SVG version that separates the logic entirely and generates an SVG graphic that can be created/downloaded on the fly. But I'm still fine tuning that.
 
 Also, obviously, this is only set up to work in a specific area, but you could easily adapt it to map patent data anywhere.
 
 <h2>More Info</h2>
 See my blog entry here: https://www.wildcathistory.net/2019/02/generated-maps-of-original-land-owners.html
