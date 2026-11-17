// Hand-authored, evergreen rankings. Values are ordering keys, not live feeds.
// Sources and answer values are sent to a player only after their submission.
const sources = {
  planet: ['NASA · Planetary Fact Sheet', 'https://nssdc.gsfc.nasa.gov/planetary/factsheet/'],
  moon: ['NASA JPL · Satellite physical parameters', 'https://ssd.jpl.nasa.gov/sats/phys_par/'],
  space: ['NASA · History of spaceflight', 'https://www.nasa.gov/history/'],
  probes: ['NASA Science · Missions', 'https://science.nasa.gov/missions/'],
  stars: ['ESA · Stellar radiation and stellar types', 'https://sci.esa.int/c/portal/doc.cfm?fobjectid=37854'],
  chem: ['Royal Society of Chemistry · Periodic table', 'https://periodic-table.rsc.org/'],
  hardness: ['USGS · Mineral gemstones', 'https://pubs.usgs.gov/gip/gemstones/mineral.html'],
  spectrum: ['NASA · Wavelength, frequency, and energy', 'https://imagine.gsfc.nasa.gov/science/toolbox/spectrum_chart.html'],
  geology: ['National Park Service · Geologic time scale', 'https://www.nps.gov/subjects/geology/time-scale.htm'],
  taxonomy: ['OpenStax Biology · Organizing life on Earth', 'https://openstax.org/books/biology-2e/pages/20-1-organizing-life-on-earth'],
  particles: ['NIST · Fundamental physical constants', 'https://physics.nist.gov/cuu/Constants/'],
  isotopes: ['IAEA · Live Chart of Nuclides', 'https://www-nds.iaea.org/relnsd/vcharthtml/VChartHTML.html'],
  area: ['World Bank · Surface area (sq. km)', 'https://data.worldbank.org/indicator/AG.SRF.TOTL.K2'],
  continents: ['National Geographic · Continent', 'https://education.nationalgeographic.org/resource/Continent/'],
  states: ['U.S. Census Bureau · 2010 state area measurements', 'https://www.census.gov/geographies/reference-files/2010/geo/state-area.html'],
  islands: ['Guinness World Records · Largest island', 'https://www.guinnessworldrecords.com/world-records/largest-island'],
  mountains: ['Guinness World Records · Tallest mountain', 'https://www.guinnessworldrecords.com/world-records/tallest-mountain'],
  lakes: ['NASA JPL · World lakes', 'https://largelakes.jpl.nasa.gov/world-lakes/'],
  parks: ['National Park Service · Park anniversaries', 'https://www.nps.gov/subjects/npscelebrates/park-anniversaries.htm'],
  flags: ['Australian Government · National flag', 'https://www.pmc.gov.au/honours-and-symbols/australian-national-symbols/australian-national-flag'],
  coordinates: ['GeoNames · Geographical database', 'https://www.geonames.org/'],
  zones: ['IANA · Time zone database', 'https://www.iana.org/time-zones'],
  presidents: ['National Archives · U.S. presidents', 'https://www.archives.gov/research/census/presidents'],
  admission: ['Congressional Research Service · Admission of states', 'https://www.congress.gov/crs-product/R47747'],
  amendments: ['National Archives · Constitutional amendments', 'https://www.archives.gov/founding-docs/amendments-11-27'],
  landmarks: ['UNESCO · World Heritage List', 'https://whc.unesco.org/en/list/'],
  discovery: ['Science Museum · History of science', 'https://www.sciencemuseum.org.uk/objects-and-stories'],
  apollo: ['NASA · Moon missions and landing dates', 'https://science.nasa.gov/moon/missions/'],
  computers: ['Computer History Museum · Timeline', 'https://www.computerhistory.org/timeline/'],
  history: ['Encyclopaedia Britannica · World history', 'https://www.britannica.com/browse/World-History'],
  scientists: ['Nobel Prize · Laureates', 'https://www.nobelprize.org/prizes/lists/all-nobel-prizes/'],
  physics: ['Nobel Prize · Physics laureates', 'https://www.nobelprize.org/prizes/lists/all-nobel-prizes-in-physics/'],
  pixar: ['Pixar · Feature films', 'https://www.pixar.com/feature-films/'],
  disney: ['Walt Disney Animation Studios · Films', 'https://disneyanimation.com/films/'],
  starwars: ['Lucasfilm · Star Wars release order', 'https://www.starwars.com/news/star-wars-movies-and-series-guide'],
  marvel: ['Marvel · Movies', 'https://www.marvel.com/movies'],
  potter: ['Bloomsbury · Harry Potter publishing', 'https://www.bloomsbury.com/uk/connect/about-us/our-success/harry-potter-publishing/'],
  narnia: ['C. S. Lewis · Official biography and timeline', 'https://www.cslewis.com/us/about-cs-lewis/'],
  nintendo: ['Nintendo · Hardware history', 'https://www.nintendo.com/en-gb/Hardware/Nintendo-History/Nintendo-History-625945.html'],
  playstation: ['Sony · PlayStation history', 'https://www.playstation.com/en-us/playstation-history/'],
  books: ['Library of Congress · Books catalog', 'https://catalog.loc.gov/'],
  authors: ['British Library · Authors', 'https://www.britishlibrary.cn/en/authors/'],
  beatles: ['The Beatles · Albums', 'https://www.thebeatles.com/albums'],
  notes: ['UNSW · Note frequencies', 'https://newt.phys.unsw.edu.au/jw/notes.html'],
  franchises: ['Nintendo · Company history', 'https://press.nintendo.com/CompanyHistory'],
  film: ['BFI · Film and people collections', 'https://www.bfi.org.uk/'],
  pokemon: ['The Pokémon Company · Pokédex', 'https://www.pokemon.com/us/pokedex'],
  athletics: ['World Athletics · Technical rules', 'https://worldathletics.org/about-iaaf/documents/book-of-rules'],
  teams: ['Olympics · Sports', 'https://www.olympics.com/en/sports/'],
  snooker: ['WPBSA · Official snooker rules', 'https://wpbsa.com/governance/rules-of-snooker-and-billiards/'],
  pool: ['World Pool Association · Rules', 'https://wpapool.com/rules/'],
  fifa: ['FIFA · World Cup archives', 'https://www.archives.fifa.com/fifa_world_cup'],
  olympics: ['International Olympic Committee · Past Games', 'https://www.olympics.com/en/olympic-games'],
  swimming: ['World Aquatics · Swimming rules', 'https://www.worldaquatics.com/rules/competition-regulations'],
  darts: ['Professional Darts Corporation · Rules', 'https://www.pdc.tv/players/rules-darts'],
  polygon: ['Wolfram MathWorld · Regular polygon', 'https://mathworld.wolfram.com/RegularPolygon.html'],
  polyhedron: ['Wolfram MathWorld · Polyhedron', 'https://mathworld.wolfram.com/Polyhedron.html'],
  roman: ['Wolfram MathWorld · Roman numerals', 'https://mathworld.wolfram.com/RomanNumerals.html'],
  factorial: ['Wolfram MathWorld · Factorial', 'https://mathworld.wolfram.com/Factorial.html'],
  numbers: ['Wolfram MathWorld · Large number', 'https://mathworld.wolfram.com/LargeNumber.html'],
  si: ['NIST · Unit conversion factors', 'https://www.nist.gov/pml/special-publication-811/nist-guide-si-appendix-b-conversion-factors/nist-guide-si-appendix-b9'],
  prefixes: ['NIST · Metric prefixes', 'https://www.nist.gov/pml/owm/metric-si-prefixes'],
  binary: ['NIST · Binary prefixes', 'https://physics.nist.gov/cuu/Units/binary.html'],
  angles: ['Wolfram MathWorld · Radian', 'https://mathworld.wolfram.com/Radian.html'],
  music: ['Open Music Theory · Rhythmic values', 'https://viva.pressbooks.pub/openmusictheory/chapter/rhythmic-and-rest-values/'],
  paper: ['ISO · ISO 216 paper sizes', 'https://www.iso.org/standard/36631.html'],
  temperature: ['NIST · Temperature units', 'https://www.nist.gov/pml/owm/si-units-temperature'],
  fractions: ['OpenStax · Fractions', 'https://openstax.org/books/prealgebra-2e/pages/4-introduction'],
  scrabble: ['Hasbro · Scrabble instructions', 'https://instructions.hasbro.com/en-us/instruction/scrabble-game'],
  coins: ['U.S. Mint · Circulating coins', 'https://www.usmint.gov/learn/coins-and-medals/circulating-coins']
};

const puzzles = [];
function add(id, title, category, lowLabel, highLabel, source, unit, rows, note = '') {
  const sourceKeys = Array.isArray(source) ? source : [source];
  puzzles.push({
    id, title, category, lowLabel, highLabel,
    instructions: `Put ${lowLabel.toLowerCase()} at the bottom and ${highLabel.toLowerCase()} at the top.`,
    note,
    sources: sourceKeys.map(key => ({ title: sources[key][0], url: sources[key][1] })),
    items: rows.map(([label, value, display]) => ({ label, value, valueLabel: display || `${value.toLocaleString('en-US', { maximumFractionDigits: 6 })}${unit ? ` ${unit}` : ''}` }))
  });
}

// 01–15 · Space. Planet data uses NASA's metric fact sheet; rotation is solar
// day length, not sidereal rotation, and temperatures are the listed means.
add('planet-diameters', 'Planets by size', 'Space', 'Smallest', 'Largest', 'planet', 'km across', [['Mercury',4879],['Mars',6792],['Earth',12756],['Neptune',49528],['Saturn',120536],['Jupiter',142984]], 'Equatorial diameters, rounded.');
add('planet-masses', 'Planets on the scales', 'Space', 'Lightest', 'Heaviest', 'planet', '× 10²⁴ kg', [['Mercury',.330],['Venus',4.87],['Earth',5.97],['Uranus',86.8],['Neptune',102],['Jupiter',1898]]);
add('planet-years', 'How long is a year?', 'Space', 'Shortest year', 'Longest year', 'planet', 'Earth days', [['Mercury',88],['Venus',224.7],['Earth',365.2],['Mars',687],['Jupiter',4331],['Neptune',59800]]);
add('planet-distances', 'A trip away from the Sun', 'Space', 'Closest to the Sun', 'Farthest from the Sun', 'planet', 'million km', [['Mercury',57.9],['Venus',108.2],['Earth',149.6],['Mars',228],['Saturn',1432],['Neptune',4515]], 'Mean orbital distance.');
add('planet-densities', 'The densest worlds', 'Space', 'Least dense', 'Most dense', 'planet', 'kg/m³', [['Saturn',687],['Uranus',1270],['Jupiter',1326],['Neptune',1638],['Mars',3934],['Earth',5514]]);
add('planet-temperatures', 'Cold worlds, hot worlds', 'Space', 'Coldest', 'Hottest', 'planet', '°C mean', [['Neptune',-200],['Uranus',-195],['Saturn',-140],['Mars',-65],['Mercury',167],['Venus',464]], 'NASA fact-sheet mean temperatures; gas giants use an atmospheric reference level.');
add('planet-days', 'When does the Sun rise again?', 'Space', 'Shortest day', 'Longest day', 'planet', 'Earth hours', [['Jupiter',9.9],['Saturn',10.7],['Neptune',16.1],['Earth',24],['Venus',2802],['Mercury',4222.6]], 'Solar day: noon to noon.');
add('escape-speeds', 'Leaving a planet behind', 'Space', 'Lowest escape speed', 'Highest escape speed', 'planet', 'km/s', [['Mercury',4.3],['Mars',5],['Earth',11.2],['Uranus',21.3],['Saturn',35.5],['Jupiter',59.5]]);
add('orbital-speeds', 'Racing around the Sun', 'Space', 'Slowest orbit speed', 'Fastest orbit speed', 'planet', 'km/s', [['Neptune',5.4],['Uranus',6.8],['Saturn',9.7],['Jupiter',13.1],['Earth',29.8],['Mercury',47.4]], 'Mean orbital speed, not rotation speed.');
add('planet-tilts', 'Worlds on a tilt', 'Space', 'Smallest axial tilt', 'Largest axial tilt', 'planet', 'degrees', [['Mercury',.034],['Jupiter',3.1],['Earth',23.4],['Saturn',26.7],['Uranus',97.8],['Venus',177.4]], 'Obliquity measured from 0° to 180°, including retrograde axes.');
add('moon-sizes', 'Six mighty moons', 'Space', 'Smallest radius', 'Largest radius', 'moon', 'km mean radius', [['Triton',1353.4],['Europa',1560.8],['The Moon',1737.4],['Io',1821.6],['Titan',2574.7],['Ganymede',2634.1]], 'Approximate mean radii.');
add('space-firsts', 'Milestones beyond Earth', 'History', 'Earliest event', 'Latest event', 'space', '', [['Sputnik 1 launches',1957],['Gagarin orbits Earth',1961],['Apollo 11 Moon landing',1969],['First Space Shuttle launch',1981],['Hubble launches',1990],['First ISS module launches',1998]]);
add('probe-launches', 'Explorers leaving Earth', 'Space', 'Earliest launch', 'Latest launch', 'probes', '', [['Voyager 1',1977],['Galileo',1989],['Cassini',1997],['New Horizons',2006],['Juno',2011],['Parker Solar Probe',2018]]);
add('telescope-launches', 'Eyes in the sky', 'Space', 'Earliest launch', 'Latest launch', 'probes', '', [['IRAS',1983],['Hubble',1990],['Chandra',1999],['Spitzer',2003],['Kepler',2009],['James Webb',2021]]);
add('star-types', 'The temperature of starlight', 'Space', 'Coolest spectral type', 'Hottest spectral type', 'stars', '', [['M-type',1,'Coolest of these types'],['K-type',2,'Warmer than M'],['G-type',3,'Warmer than K'],['F-type',4,'Warmer than G'],['A-type',5,'Warmer than F'],['B-type',6,'Hottest of these types']], 'Main-sequence spectral classes, ranked by surface temperature.');

// 16–30 · Science and nature. Approximate quantities are explicitly labeled.
add('atomic-numbers', 'Count the protons', 'Science', 'Fewest protons', 'Most protons', 'chem', 'protons', [['Hydrogen',1],['Carbon',6],['Oxygen',8],['Sodium',11],['Iron',26],['Gold',79]]);
add('metal-densities', 'Equal cubes of metal', 'Science', 'Lightest cube', 'Heaviest cube', 'chem', 'g/cm³', [['Magnesium',1.74],['Aluminium',2.70],['Iron',7.87],['Copper',8.96],['Silver',10.5],['Gold',19.3]], 'Same volume, at room temperature.');
add('melting-metals', 'Turn up the heat', 'Science', 'Lowest melting point', 'Highest melting point', 'chem', '°C', [['Mercury',-38.829],['Gallium',29.7646],['Tin',231.928],['Lead',327.462],['Aluminium',660.323],['Iron',1538]], 'Element melting points at standard pressure.');
add('noble-boiling', 'Boiling the noble gases', 'Science', 'Lowest boiling point', 'Highest boiling point', 'chem', '°C', [['Helium',-268.928],['Neon',-246.046],['Argon',-185.848],['Krypton',-153.415],['Xenon',-108.099],['Radon',-61.7]], 'Normal boiling points.');
add('atomic-masses', 'Atoms by average mass', 'Science', 'Lightest atom', 'Heaviest atom', 'chem', 'relative atomic mass', [['Lithium',6.94],['Carbon',12.011],['Oxygen',15.999],['Aluminium',26.982],['Iron',55.845],['Uranium',238.029]], 'Natural abundance weighted relative atomic masses, rounded.');
add('electronegativity', 'Pulling on electrons', 'Science', 'Weakest attraction', 'Strongest attraction', 'chem', 'Pauling scale', [['Caesium',.79],['Potassium',.82],['Sodium',.93],['Magnesium',1.31],['Carbon',2.55],['Fluorine',3.98]], 'Rank electronegativity on the Pauling scale.');
add('ionisation-energy', 'Letting one electron go', 'Science', 'Least energy needed', 'Most energy needed', 'chem', 'kJ/mol', [['Potassium',418.8],['Sodium',495.8],['Aluminium',577.5],['Magnesium',737.7],['Carbon',1086.5],['Neon',2080.7]], 'First ionisation energies of gaseous atoms.');
add('element-discoveries', 'New names on the periodic table', 'Science', 'Earliest discovery', 'Latest discovery', 'chem', '', [['Helium',1868],['Gallium',1875],['Germanium',1886],['Radium',1898],['Hafnium',1923],['Technetium',1937]], 'Discovery years credited by the Royal Society of Chemistry.');
add('mineral-hardness', 'The scratch test', 'Nature', 'Softest', 'Hardest', 'hardness', 'Mohs', [['Talc',1],['Gypsum',2],['Calcite',3],['Fluorite',4],['Quartz',7],['Diamond',10]]);
add('em-frequency', 'Invisible waves', 'Science', 'Lowest frequency band', 'Highest frequency band', 'spectrum', '', [['Radio waves',1,'Lowest frequency here'],['Microwaves',2,'Above radio'],['Infrared',3,'Above microwaves'],['Visible light',4,'Above infrared'],['Ultraviolet',5,'Above visible light'],['X-rays',6,'Highest frequency here']], 'Use the conventional electromagnetic spectrum bands.');
add('rainbow-wavelength', 'Stretching the rainbow', 'Science', 'Shortest wavelength', 'Longest wavelength', 'spectrum', '', [['Violet',1,'Shortest visible wavelengths'],['Blue',2,'Between violet and green'],['Green',3,'Between blue and yellow'],['Yellow',4,'Between green and orange'],['Orange',5,'Between yellow and red'],['Red',6,'Longest visible wavelengths']]);
add('paleozoic-periods', 'A very old timeline', 'Nature', 'Earliest period', 'Latest period', 'geology', '', [['Cambrian',1,'1st of these periods'],['Ordovician',2,'2nd of these periods'],['Silurian',3,'3rd of these periods'],['Devonian',4,'4th of these periods'],['Carboniferous',5,'5th of these periods'],['Permian',6,'6th of these periods']], 'Carboniferous combines the Mississippian and Pennsylvanian.');
add('taxonomy', 'Sorting the tree of life', 'Nature', 'Most specific rank', 'Broadest rank', 'taxonomy', '', [['Genus',1,'Contains species'],['Family',2,'Contains genera'],['Order',3,'Contains families'],['Class',4,'Contains orders'],['Phylum',5,'Contains classes'],['Kingdom',6,'Contains phyla']]);
add('particle-masses', 'The tiniest weigh-in', 'Science', 'Lightest particle', 'Heaviest particle', 'particles', '', [['Electron',.00054858,'≈ 0.000549 u'],['Muon',.113429,'≈ 0.1134 u'],['Charged pion',.149833,'≈ 0.1498 u'],['Proton',1.007276,'≈ 1.00728 u'],['Neutron',1.008665,'≈ 1.00866 u'],['Alpha particle',4.001506,'≈ 4.00151 u']], 'Rest masses in unified atomic mass units (u).');
add('half-lives', 'Waiting for half to decay', 'Science', 'Shortest half-life', 'Longest half-life', 'isotopes', '', [['Iodine-131',.022,'≈ 8.02 days'],['Cobalt-60',5.271,'≈ 5.27 years'],['Tritium',12.32,'≈ 12.32 years'],['Caesium-137',30.05,'≈ 30.05 years'],['Carbon-14',5700,'≈ 5,700 years'],['Uranium-238',4.468e9,'≈ 4.47 billion years']], 'Approximate physical half-lives, not biological residence times.');

// 31–40 · Geography. Use physical facts and fixed historical snapshots rather
// than population estimates or other values that change each year.
add('country-area', 'Room to roam', 'Geography', 'Smallest area', 'Largest area', 'area', 'km², approximately', [['Germany',357000],['Japan',378000],['India',3287000],['Brazil',8516000],['Canada',9985000],['Russia',17098000]], 'Total surface areas, rounded.');
add('continent-area', 'Continental scale', 'Geography', 'Smallest continent', 'Largest continent', 'continents', 'million km², approximately', [['Australia',7.7],['Europe',10.2],['Antarctica',14.2],['South America',17.8],['North America',24.7],['Asia',44.6]], 'Seven-continent convention; Australia is the continent, not all Oceania.');
add('state-area', 'Big states, bigger states', 'Geography', 'Smallest area', 'Largest area', 'states', 'square miles', [['Arizona',113990],['New Mexico',121590],['Montana',147040],['California',163695],['Texas',268596],['Alaska',665384]], '2010 Census total areas, including water.');
add('island-area', 'Islands on the map', 'Geography', 'Smallest island', 'Largest island', 'islands', 'km², approximately', [['Sumatra',443066],['Baffin Island',507451],['Madagascar',587041],['Borneo',748168],['New Guinea',785753],['Greenland',2166086]], 'Whole islands, irrespective of national borders; Australia is a continent.');
add('mountain-height', 'Summit after summit', 'Geography', 'Lowest summit', 'Highest summit', 'mountains', 'm above sea level', [['Manaslu',8163],['Makalu',8485],['Lhotse',8516],['Kangchenjunga',8586],['K2',8611],['Everest',8848.86]], 'Approximate summit elevations above sea level.');
add('lake-area', 'A world of lakes', 'Geography', 'Smallest surface area', 'Largest surface area', 'lakes', 'km², approximately', [['Tanganyika',32821],['Michigan',57399],['Huron',59757],['Victoria',67075],['Superior',81936],['Caspian Sea',378119]], 'NASA JPL reference areas, rounded; the Caspian is an inland lake.');
add('park-birthdays', 'When did the parks begin?', 'Geography', 'Earliest national park', 'Latest national park', 'parks', '', [['Yellowstone',1872],['Yosemite',1890],['Denali',1917],['Grand Canyon',1919],['Grand Teton',1929],['Everglades',1947]], 'Year established as a U.S. national park, including original park names.');
add('flag-stars', 'Stars on national flags', 'Geography', 'Fewest stars', 'Most stars', 'flags', 'stars', [['Türkiye',1],['New Zealand',4],['China',5],['Australia',6],['Brazil',27],['United States',50]], 'Count all stars, including the Commonwealth Star on Australia’s flag.');
add('capital-latitudes', 'From south to north', 'Geography', 'Farthest south', 'Farthest north', 'coordinates', '° latitude, approximately', [['Canberra',-35.28],['Nairobi',-1.29],['Cairo',30.04],['Tokyo',35.68],['Paris',48.86],['London',51.51]], 'City-center latitudes; north is positive.');
add('clock-offsets', 'Whose clock is ahead?', 'Geography', 'Farthest behind UTC', 'Farthest ahead of UTC', 'zones', '', [['Honolulu',-10,'UTC−10'],['Reykjavík',0,'UTC+0'],['Dubai',4,'UTC+4'],['Kathmandu',5.75,'UTC+5:45'],['Bangkok',7,'UTC+7'],['Tokyo',9,'UTC+9']], 'Standard civil offsets in these cities; none observes seasonal daylight saving.');

// 41–50 · History.
add('early-presidents', 'The first presidents', 'History', 'Earliest first term', 'Latest first term', 'presidents', '', [['George Washington',1789],['John Adams',1797],['Thomas Jefferson',1801],['James Madison',1809],['James Monroe',1817],['John Quincy Adams',1825]]);
add('statehood', 'Joining the Union', 'History', 'Earliest statehood', 'Latest statehood', 'admission', '', [['Delaware',1787],['Vermont',1791],['Ohio',1803],['Texas',1845],['California',1850],['Hawaii',1959]]);
add('amendment-dates', 'Changing the Constitution', 'History', 'Earliest ratification', 'Latest ratification', 'amendments', '', [['Bill of Rights',1791],['13th Amendment',1865],['14th Amendment',1868],['19th Amendment',1920],['22nd Amendment',1951],['26th Amendment',1971]]);
add('landmark-openings', 'The world’s big openings', 'History', 'Earliest opening', 'Latest opening', 'landmarks', '', [['Statue of Liberty',1886],['Eiffel Tower',1889],['Empire State Building',1931],['Golden Gate Bridge',1937],['Sydney Opera House',1973],['Burj Khalifa',2010]], 'Official dedication or public opening year, not the start of construction.');
add('science-milestones', 'Ideas that changed everything', 'History', 'Earliest milestone', 'Latest milestone', 'discovery', '', [['Copernicus publishes De revolutionibus',1543],['Newton publishes Principia',1687],['Darwin publishes On the Origin of Species',1859],['Mendeleev presents his periodic table',1869],['Einstein publishes special relativity',1905],['DNA double-helix model published',1953]]);
add('apollo-landings', 'Six visits to the Moon', 'History', 'Earliest landing', 'Latest landing', 'apollo', '', [['Apollo 11',19690720,'20 July 1969'],['Apollo 12',19691119,'19 November 1969'],['Apollo 14',19710205,'5 February 1971'],['Apollo 15',19710730,'30 July 1971'],['Apollo 16',19720421,'21 April 1972'],['Apollo 17',19721211,'11 December 1972']]);
add('computing-debuts', 'A timeline of technology', 'Technology', 'Earliest introduction', 'Latest introduction', 'computers', '', [['Intel 4004',1971],['Apple II',1977],['Original Macintosh',1984],['Windows 95',1995],['Original iPhone',2007],['Original iPad',2010]]);
add('world-milestones', 'Turning points in history', 'History', 'Earliest event', 'Latest event', 'history', '', [['Magna Carta sealed',1215],['Gutenberg Bible completed',1455],['Columbus reaches the Americas',1492],['U.S. Declaration of Independence',1776],['Storming of the Bastille',1789],['Berlin Wall opens',1989]]);
add('scientist-births', 'When were these scientists born?', 'History', 'Earliest birth', 'Latest birth', 'scientists', '', [['Isaac Newton',1643],['Charles Darwin',1809],['Marie Curie',1867],['Albert Einstein',1879],['Jane Goodall',1934],['Stephen Hawking',1942]], 'Newton’s date uses the Gregorian calendar.');
add('physics-nobels', 'A century of physics prizes', 'History', 'Earliest prize', 'Latest prize', 'physics', '', [['Albert Einstein',1921],['Niels Bohr',1922],['James Chadwick',1935],['Richard Feynman',1965],['Peter Higgs',2013],['Roger Penrose',2020]], 'Year of the Nobel Prize in Physics, not the ceremony date.');

// 51–65 · Books, films, music, and games. Releases refer to original releases,
// not reissues. Console dates use the first release anywhere in the world.
add('pixar-premieres', 'The Pixar premiere queue', 'Film & TV', 'Earliest film', 'Latest film', 'pixar', '', [['Toy Story',1995],['A Bug’s Life',1998],['Monsters, Inc.',2001],['Finding Nemo',2003],['Up',2009],['Inside Out',2015]]);
add('disney-premieres', 'Disney through the decades', 'Film & TV', 'Earliest film', 'Latest film', 'disney', '', [['Snow White and the Seven Dwarfs',1937],['Pinocchio',1940],['Cinderella',1950],['The Jungle Book',1967],['The Lion King',1994],['Frozen',2013]], 'Original animated theatrical films.');
add('star-wars-premieres', 'Star Wars, opening night', 'Film & TV', 'Earliest release', 'Latest release', 'starwars', '', [['A New Hope',1977],['The Empire Strikes Back',1980],['Return of the Jedi',1983],['The Phantom Menace',1999],['Attack of the Clones',2002],['Revenge of the Sith',2005]], 'Release order, not the story’s internal chronology.');
add('marvel-premieres', 'An expanding Marvel universe', 'Film & TV', 'Earliest film', 'Latest film', 'marvel', '', [['Iron Man',2008],['Thor',2011],['The Avengers',2012],['Guardians of the Galaxy',2014],['Black Panther',2018],['Avengers: Endgame',2019]]);
add('potter-publication', 'Books arriving by owl', 'Books', 'Earliest book', 'Latest book', 'potter', '', [['Philosopher’s Stone',1997],['Chamber of Secrets',1998],['Prisoner of Azkaban',1999],['Goblet of Fire',2000],['Order of the Phoenix',2003],['Half-Blood Prince',2005]], 'Original U.K. publication years.');
add('narnia-publication', 'First journeys into Narnia', 'Books', 'Earliest publication', 'Latest publication', 'narnia', '', [['The Lion, the Witch and the Wardrobe',1950],['Prince Caspian',1951],['The Voyage of the Dawn Treader',1952],['The Silver Chair',1953],['The Horse and His Boy',1954],['The Magician’s Nephew',1955]], 'Publication order, not the story’s internal chronology.');
add('nintendo-hardware', 'Nintendo generations', 'Games', 'Earliest launch', 'Latest launch', 'nintendo', '', [['Famicom',1983],['Super Famicom',1990],['Nintendo 64',1996],['GameCube',2001],['Wii',2006],['Nintendo Switch',2017]], 'First worldwide release; the Famicom later became the NES abroad.');
add('playstation-hardware', 'The PlayStation family', 'Games', 'Earliest launch', 'Latest launch', 'playstation', '', [['PlayStation',1994],['PlayStation 2',2000],['PSP',2004],['PlayStation 3',2006],['PlayStation Vita',2011],['PlayStation 5',2020]], 'First release anywhere, including handhelds.');
add('classic-novels', 'First editions on the shelf', 'Books', 'Earliest publication', 'Latest publication', 'books', '', [['Frankenstein',1818],['A Christmas Carol',1843],['Moby-Dick',1851],['Alice’s Adventures in Wonderland',1865],['Dracula',1897],['The Great Gatsby',1925]]);
add('author-births', 'The writers’ timeline', 'Books', 'Earliest birth', 'Latest birth', 'authors', '', [['William Shakespeare',1564],['Jane Austen',1775],['Charles Dickens',1812],['Mark Twain',1835],['Virginia Woolf',1882],['Agatha Christie',1890]]);
add('beatles-albums', 'The Beatles on record', 'Music', 'Earliest album', 'Latest album', 'beatles', '', [['Please Please Me',1963],['Help!',1965],['Revolver',1966],['Sgt. Pepper’s Lonely Hearts Club Band',1967],['The Beatles (White Album)',1968],['Abbey Road',1969]], 'Original U.K. studio album release years.');
add('musical-pitches', 'Climbing the keyboard', 'Music', 'Lowest pitch', 'Highest pitch', 'notes', 'Hz, approximately', [['Middle C (C4)',261.63],['D4',293.66],['E4',329.63],['F4',349.23],['G4',392],['A4',440]], 'Equal temperament, with A4 tuned to 440 Hz.');
add('nintendo-series', 'The first game in the series', 'Games', 'Earliest debut', 'Latest debut', 'franchises', '', [['Super Mario Bros.',1985],['The Legend of Zelda',1986],['Kirby',1992],['Pokémon',1996],['Animal Crossing',2001],['Splatoon',2015]], 'First release of the named series, anywhere in the world.');
add('director-births', 'Behind the camera', 'Film & TV', 'Earliest birth', 'Latest birth', 'film', '', [['Martin Scorsese',1942],['Steven Spielberg',1946],['James Cameron',1954],['Christopher Nolan',1970],['Jordan Peele',1979],['Greta Gerwig',1983]]);
add('pokedex-numbers', 'Find them in the Pokédex', 'Games', 'Lowest National Dex number', 'Highest National Dex number', 'pokemon', '', [['Bulbasaur',1,'National #001'],['Charmander',4,'National #004'],['Squirtle',7,'National #007'],['Pikachu',25,'National #025'],['Jigglypuff',39,'National #039'],['Eevee',133,'National #133']]);

// 66–75 · Sport and games.
add('track-distances', 'One lap, many laps', 'Sport', 'Shortest race', 'Longest race', 'athletics', 'metres', [['100-metre sprint',100],['200-metre sprint',200],['400-metre race',400],['800-metre race',800],['1,500-metre race',1500],['5,000-metre race',5000]]);
add('team-sizes', 'How many on a side?', 'Sport', 'Fewest players', 'Most players', 'teams', 'players', [['Basketball',5],['Indoor volleyball',6],['Baseball',9],['Association football',11],['Rugby league',13],['Rugby union',15]], 'Players on the court or field for one full team; substitutes excluded.');
add('snooker-colours', 'The colours after the reds', 'Sport', 'Fewest points', 'Most points', 'snooker', 'points', [['Yellow',2],['Green',3],['Brown',4],['Blue',5],['Pink',6],['Black',7]]);
add('pool-solids', 'Know your pool balls', 'Sport', 'Lowest ball number', 'Highest ball number', 'pool', '', [['Yellow solid',1,'Ball 1'],['Blue solid',2,'Ball 2'],['Red solid',3,'Ball 3'],['Purple solid',4,'Ball 4'],['Orange solid',5,'Ball 5'],['Green solid',6,'Ball 6']], 'Traditional WPA ball colours, not alternate broadcast sets.');
add('throwing-weights', 'Heavy things, long throws', 'Sport', 'Lightest implement', 'Heaviest implement', 'athletics', 'grams', [['Women’s javelin',600],['Men’s javelin',800],['Women’s discus',1000],['Men’s discus',2000],['Women’s shot',4000],['Men’s shot',7260]], 'Senior international competition implements.');
add('world-cup-hosts', 'When did they host the World Cup?', 'Sport', 'Earliest tournament', 'Latest tournament', 'fifa', '', [['Uruguay',1930],['Italy',1934],['Brazil',1950],['England',1966],['United States',1994],['South Africa',2010]], 'The specified country’s first men’s FIFA World Cup as host.');
add('summer-hosts', 'Summer on the world stage', 'Sport', 'Earliest Games', 'Latest Games', 'olympics', '', [['Berlin',1936],['Helsinki',1952],['Tokyo',1964],['Seoul',1988],['Sydney',2000],['Rio de Janeiro',2016]], 'These cities’ first Summer Olympic Games.');
add('winter-hosts', 'Winter on the world stage', 'Sport', 'Earliest Games', 'Latest Games', 'olympics', '', [['Chamonix',1924],['Oslo',1952],['Innsbruck',1964],['Nagano',1998],['Turin',2006],['PyeongChang',2018]], 'These cities’ first Winter Olympic Games.');
add('swimming-distances', 'Lengths in the pool', 'Sport', 'Shortest event', 'Longest event', 'swimming', 'metres', [['50-metre freestyle',50],['100-metre freestyle',100],['200-metre freestyle',200],['400-metre freestyle',400],['800-metre freestyle',800],['1,500-metre freestyle',1500]]);
add('darts-scores', 'One dart, six targets', 'Sport', 'Fewest points', 'Most points', 'darts', 'points', [['Single 20',20],['Outer bull',25],['Double 16',32],['Double 20',40],['Inner bull',50],['Triple 20',60]]);

// 76–100 · Numbers, everyday measurements, and a few deceptively small things.
add('polygon-sides', 'Shapes with the most sides', 'Numbers', 'Fewest sides', 'Most sides', 'polygon', 'sides', [['Hendecagon',11],['Tetradecagon',14],['Pentadecagon',15],['Heptadecagon',17],['Octadecagon',18],['Icosagon',20]]);
add('solid-vertices', 'Count the corners', 'Numbers', 'Fewest vertices', 'Most vertices', 'polyhedron', 'vertices', [['Tetrahedron',4],['Square pyramid',5],['Octahedron',6],['Cube',8],['Icosahedron',12],['Dodecahedron',20]]);
add('polygon-diagonals', 'Lines across a polygon', 'Numbers', 'Fewest diagonals', 'Most diagonals', 'polygon', 'diagonals', [['Pentagon',5],['Hexagon',9],['Heptagon',14],['Octagon',20],['Nonagon',27],['Decagon',35]], 'Diagonals join nonadjacent vertices.');
add('interior-angles', 'The angle inside', 'Numbers', 'Smallest interior angle', 'Largest interior angle', 'polygon', 'degrees', [['Equilateral triangle',60],['Square',90],['Regular pentagon',108],['Regular hexagon',120],['Regular octagon',135],['Regular dodecagon',150]], 'One interior angle of each regular polygon.');
add('roman-numerals', 'Numbers carved in stone', 'Numbers', 'Lowest value', 'Highest value', 'roman', '', [['I',1],['V',5],['X',10],['L',50],['C',100],['M',1000]]);
add('factorials', 'Factorial fever', 'Numbers', 'Smallest result', 'Largest result', 'factorial', '', [['2!',2],['3!',6],['4!',24],['5!',120],['6!',720],['7!',5040]]);
add('big-numbers', 'Just how big is big?', 'Numbers', 'Smallest number', 'Largest number', 'numbers', '', [['Thousand',1e3,'10³'],['Million',1e6,'10⁶'],['Billion',1e9,'10⁹'],['Trillion',1e12,'10¹²'],['Quadrillion',1e15,'10¹⁵'],['Quintillion',1e18,'10¹⁸']], 'Modern English short scale.');
add('si-prefixes', 'The size of a prefix', 'Measurements', 'Smallest multiplier', 'Largest multiplier', 'prefixes', '', [['Nano-',1e-9,'10⁻⁹'],['Micro-',1e-6,'10⁻⁶'],['Milli-',1e-3,'10⁻³'],['Centi-',1e-2,'10⁻²'],['Kilo-',1e3,'10³'],['Mega-',1e6,'10⁶']]);
add('metric-lengths', 'Measure up', 'Measurements', 'Shortest unit', 'Longest unit', 'si', 'metres', [['Millimetre',.001],['Centimetre',.01],['Decimetre',.1],['Metre',1],['Decametre',10],['Kilometre',1000]]);
add('customary-lengths', 'Inches to miles', 'Measurements', 'Shortest unit', 'Longest unit', 'si', 'metres', [['Inch',.0254],['Foot',.3048],['Yard',.9144],['Chain',20.1168],['Furlong',201.168],['Mile',1609.344]], 'International foot and statute mile.');
add('mass-units', 'A different kind of scale', 'Measurements', 'Lightest unit', 'Heaviest unit', 'si', 'grams', [['Metric carat',.2],['Gram',1],['Ounce',28.349523125],['Pound',453.59237],['Kilogram',1000],['Metric tonne',1e6]], 'Ounce and pound mean avoirdupois, not troy.');
add('kitchen-volumes', 'A measure of the kitchen', 'Measurements', 'Smallest volume', 'Largest volume', 'si', 'mL, approximately', [['Teaspoon',4.928922],['Tablespoon',14.786765],['Fluid ounce',29.57353],['Cup',236.58824],['Pint',473.17647],['Gallon',3785.411784]], 'U.S. customary liquid units throughout.');
add('area-units', 'How much ground?', 'Measurements', 'Smallest area', 'Largest area', 'si', 'm², approximately', [['Square inch',.00064516],['Square foot',.09290304],['Square yard',.83612736],['Square metre',1],['Acre',4046.8564224],['Hectare',10000]]);
add('time-units', 'The waiting game', 'Measurements', 'Shortest duration', 'Longest duration', 'si', 'seconds', [['Second',1],['Minute',60],['Hour',3600],['Day',86400],['Week',604800],['Fortnight',1209600]], 'Standard fixed durations; a day means 24 hours.');
add('binary-storage', 'Room for one more file', 'Technology', 'Smallest capacity', 'Largest capacity', 'binary', '', [['Byte',1,'1 byte'],['Kibibyte',1024,'2¹⁰ bytes'],['Mebibyte',1048576,'2²⁰ bytes'],['Gibibyte',1073741824,'2³⁰ bytes'],['Tebibyte',1099511627776,'2⁴⁰ bytes'],['Pebibyte',1125899906842624,'2⁵⁰ bytes']], 'Binary IEC prefixes, not decimal kB or MB.');
add('speed-units', 'Same number, different speed', 'Measurements', 'Slowest speed', 'Fastest speed', 'si', 'm/s, approximately', [['1 km/h',.277778],['1 foot/second',.3048],['1 mile/hour',.44704],['1 knot',.514444],['1 metre/second',1],['1 kilometre/second',1000]]);
add('energy-units', 'Packing in the energy', 'Measurements', 'Least energy', 'Most energy', 'si', '', [['Erg',1e-7,'0.0000001 J'],['Joule',1,'1 J'],['Thermochemical calorie',4.184,'4.184 J'],['Kilojoule',1000,'1,000 J'],['Watt-hour',3600,'3,600 J'],['Kilowatt-hour',3600000,'3,600,000 J']]);
add('pressure-units', 'Under pressure', 'Measurements', 'Lowest pressure', 'Highest pressure', 'si', 'pascals, approximately', [['Pascal',1],['Hectopascal',100],['Kilopascal',1000],['Pound per square inch',6894.757],['Bar',100000],['Standard atmosphere',101325]]);
add('angle-measures', 'Around the bend', 'Numbers', 'Smallest angle', 'Largest angle', 'angles', 'degrees', [['One arcminute',1/60],['One degree',1],['One radian',180/Math.PI],['Right angle',90],['Straight angle',180],['Full turn',360]]);
add('note-lengths', 'Hold that note', 'Music', 'Shortest note', 'Longest note', 'music', '', [['Thirty-second note',1/32,'1/32 of a whole note'],['Sixteenth note',1/16,'1/16 of a whole note'],['Eighth note',1/8,'1/8 of a whole note'],['Quarter note',1/4,'1/4 of a whole note'],['Half note',1/2,'1/2 of a whole note'],['Whole note',1,'1 whole note']], 'Undotted notes at a fixed tempo.');
add('paper-sizes', 'Paperwork, supersized', 'Measurements', 'Smallest sheet', 'Largest sheet', 'paper', '', [['A5',.03125,'148 × 210 mm'],['A4',.0625,'210 × 297 mm'],['A3',.125,'297 × 420 mm'],['A2',.25,'420 × 594 mm'],['A1',.5,'594 × 841 mm'],['A0',1,'841 × 1,189 mm']], 'ISO 216 A-series sheet area.');
add('temperature-benchmarks', 'From frozen to fiery', 'Science', 'Coldest', 'Hottest', ['temperature','chem'], '°C, approximately', [['Absolute zero',-273.15],['Dry ice sublimates',-78.5],['Water freezes',0],['Typical human core temperature',37],['Water boils',100],['Iron melts',1538]], 'Water and dry-ice phase changes at one standard atmosphere; body temperature is a typical reference.');
add('fractions', 'A slice of the whole', 'Numbers', 'Smallest fraction', 'Largest fraction', 'fractions', '', [['One sixth',1/6,'1/6'],['One fifth',1/5,'1/5'],['One quarter',1/4,'1/4'],['One third',1/3,'1/3'],['One half',1/2,'1/2'],['Three quarters',3/4,'3/4']]);
add('scrabble-values', 'Letters worth their weight', 'Games', 'Fewest tile points', 'Most tile points', 'scrabble', 'points', [['A',1],['D',2],['B',3],['F',4],['K',5],['Q',10]], 'Standard English-language Scrabble tile values, before board bonuses.');
add('us-coin-values', 'Small change', 'Everyday', 'Lowest face value', 'Highest face value', 'coins', 'U.S. cents', [['Penny',1],['Nickel',5],['Dime',10],['Quarter',25],['Half dollar',50],['Dollar coin',100]]);

module.exports = puzzles;
