// Precise venue coordinates for known electronic music venues.
// Keys are "VenueName|City" format matching the scraper output.
// These override city-level jitter with exact venue locations.

export const VENUE_COORDS: Record<string, { lat: number; lng: number; address?: string }> = {
  // === San Francisco ===
  "1015 Folsom|San Francisco": { lat: 37.7780411, lng: -122.4056830, address: "1015 Folsom St, San Francisco" },
  "F8 1192 Folsom|San Francisco": { lat: 37.7752814, lng: -122.4099546, address: "1192 Folsom St, San Francisco" },
  "The Midway|San Francisco": { lat: 37.7495304, lng: -122.3860944, address: "900 Marin St, San Francisco" },
  "Envelop At The Midway|San Francisco": { lat: 37.7495304, lng: -122.3860944, address: "900 Marin St, San Francisco" },
  "Cat Club|San Francisco": { lat: 37.7753288, lng: -122.4098955, address: "1190 Folsom St, San Francisco" },
  "Make-Out Room|San Francisco": { lat: 37.7551690, lng: -122.4195356, address: "3225 22nd St, San Francisco" },
  "The Regency Ballroom|San Francisco": { lat: 37.7878176, lng: -122.4215762, address: "1300 Van Ness Ave, San Francisco" },
  "Gray Area|San Francisco": { lat: 37.7508885, lng: -122.4180722, address: "2889 Mission St, San Francisco" },
  "Noisebridge Hackerspace|San Francisco": { lat: 37.7623936, lng: -122.4190969, address: "272 Capp St, San Francisco" },
  "Phonobar|San Francisco": { lat: 37.7779856, lng: -122.4228597, address: "1500 Market St, San Francisco" },
  "Bar Part Time|San Francisco": { lat: 37.7681534, lng: -122.4241760, address: "3467 18th St, San Francisco" },
  "White Rabbit Bar|San Francisco": { lat: 37.7986923, lng: -122.4357083, address: "1726 Buchanan St, San Francisco" },
  "Hedge Coffee|San Francisco": { lat: 37.7614349, lng: -122.4161263, address: "2964 24th St, San Francisco" },
  "DNA Lounge|San Francisco": { lat: 37.7710876, lng: -122.4126126, address: "375 11th St, San Francisco" },
  "Public Works|San Francisco": { lat: 37.7688931, lng: -122.4192651, address: "161 Erie St, San Francisco" },
  "Monarch|San Francisco": { lat: 37.7809715, lng: -122.4083336, address: "101 6th St, San Francisco" },
  "The Great Northern|San Francisco": { lat: 37.7676612, lng: -122.4065246, address: "119 Utah St, San Francisco" },
  "Audio|San Francisco": { lat: 37.7713709, lng: -122.4138077, address: "316 11th St, San Francisco" },
  "Halcyon|San Francisco": { lat: 37.7714450, lng: -122.4139284, address: "314 11th St, San Francisco" },
  "Mezzanine|San Francisco": { lat: 37.7825320, lng: -122.4080650, address: "444 Jessie St, San Francisco" },
  "Temple|San Francisco": { lat: 37.7878851, lng: -122.3972190, address: "540 Howard St, San Francisco" },
  "Verso|San Francisco": { lat: 37.7793831, lng: -122.3981059, address: "99 Federal St, San Francisco" },
  "The Stud|San Francisco": { lat: 37.7714601, lng: -122.4143296, address: "399 9th St, San Francisco" },
  "El Rio|San Francisco": { lat: 37.7467953, lng: -122.4194188, address: "3158 Mission St, San Francisco" },
  "Jolene's|San Francisco": { lat: 37.7655970, lng: -122.4133319, address: "2700 16th St, San Francisco" },

  // === Oakland ===
  "Starline Social Club|Oakland": { lat: 37.8122821, lng: -122.2725458, address: "2236 Martin Luther King Jr Way, Oakland" },
  "New Parish|Oakland": { lat: 37.8076763, lng: -122.2725814, address: "1743 San Pablo Ave, Oakland" },
  "Fox Theater|Oakland": { lat: 37.8082481, lng: -122.2701322, address: "1807 Telegraph Ave, Oakland" },
  "Moonglow|Oakland": { lat: 37.8082904, lng: -122.2696920, address: "1818 Telegraph Ave, Oakland" },
  "Ugra Deva Loka|Oakland": { lat: 37.7815339, lng: -122.2412942, address: "2049 International Blvd, Oakland" },

  // === Berkeley ===
  "Cornerstone|Berkeley": { lat: 37.8665642, lng: -122.2669287, address: "2367 Shattuck Ave, Berkeley" },

  // === Santa Cruz ===
  "The Blue Lagoon|Santa Cruz": { lat: 36.9705864, lng: -122.0253571, address: "923 Pacific Ave, Santa Cruz" },

  // === Sacramento ===
  "Faces Nightclub|Sacramento": { lat: 38.5754750, lng: -121.4802600, address: "2000 K St, Sacramento" },
  "Sac Dance Lab|Sacramento": { lat: 38.5996806, lng: -121.4466974, address: "3820 Auburn Blvd, Sacramento" },
  "Channel 24|Sacramento": { lat: 38.5662337, lng: -121.4789390, address: "2415 21st St, Sacramento" },

  // === Los Angeles ===
  "Sound Nightclub|Hollywood": { lat: 34.0903, lng: -118.3388, address: "1642 N Las Palmas Ave, Hollywood" },
  "Avalon Hollywood|Hollywood": { lat: 34.1017, lng: -118.3254, address: "1735 Vine St, Hollywood" },
  "Exchange LA|Los Angeles": { lat: 34.0460, lng: -118.2504, address: "618 S Spring St, Los Angeles" },
  "Academy LA|Hollywood": { lat: 34.1015, lng: -118.3339, address: "6021 Hollywood Blvd, Hollywood" },
  "Catch One|Los Angeles": { lat: 34.0466, lng: -118.3338, address: "4067 W Pico Blvd, Los Angeles" },
  "Le Jardin|Hollywood": { lat: 34.0899, lng: -118.3358, address: "1430 N Cahuenga Blvd, Hollywood" },
  "Warehouse Project|Los Angeles": { lat: 34.0326, lng: -118.2313, address: "729 E Washington Blvd, Los Angeles" },
  "The Belasco|Los Angeles": { lat: 34.0484, lng: -118.2590, address: "1050 S Hill St, Los Angeles" },
  "Globe Theatre|Los Angeles": { lat: 34.0455, lng: -118.2496, address: "740 S Broadway, Los Angeles" },
  "Resident|Los Angeles": { lat: 34.0392, lng: -118.2323, address: "428 S Hewitt St, Los Angeles" },
  "The Mayan|Los Angeles": { lat: 34.0433, lng: -118.2604, address: "1038 S Hill St, Los Angeles" },
  "Pattern Bar|Los Angeles": { lat: 34.0462, lng: -118.2476, address: "100 W 9th St, Los Angeles" },
  "Zebulon|Los Angeles": { lat: 34.0900, lng: -118.2681, address: "2478 Fletcher Dr, Los Angeles" },
  "Lot 613|Los Angeles": { lat: 34.0398, lng: -118.2336, address: "613 Imperial St, Los Angeles" },
  "6AM|Los Angeles": { lat: 34.0338, lng: -118.2338, address: "660 S Santa Fe Ave, Los Angeles" },
  "Club Bahia|Los Angeles": { lat: 34.0809, lng: -118.2639, address: "1130 W Sunset Blvd, Los Angeles" },
  "Echoplex|Los Angeles": { lat: 34.0778, lng: -118.2608, address: "1154 Glendale Blvd, Los Angeles" },
  "The Echo|Los Angeles": { lat: 34.0782, lng: -118.2606, address: "1822 W Sunset Blvd, Los Angeles" },
  "Hookah Lounge Hollywood|Hollywood": { lat: 34.1014, lng: -118.3277, address: "6462 Hollywood Blvd, Hollywood" },
  "El Rey Theatre|Los Angeles": { lat: 34.0623, lng: -118.3556, address: "5515 Wilshire Blvd, Los Angeles" },
  "Los Globos|Los Angeles": { lat: 34.0780, lng: -118.2609, address: "3040 W Sunset Blvd, Los Angeles" },
  "Boardner's|Hollywood": { lat: 34.1012, lng: -118.3349, address: "1652 N Cherokee Ave, Hollywood" },
  "Shrine Auditorium|Los Angeles": { lat: 34.0234, lng: -118.2839, address: "665 W Jefferson Blvd, Los Angeles" },

  // === Seattle ===
  "Kremwerk|Seattle": { lat: 47.6131, lng: -122.3289, address: "1809 Minor Ave, Seattle" },
  "Re-bar|Seattle": { lat: 47.6160, lng: -122.3265, address: "1114 Howell St, Seattle" },
  "Monkey Loft|Seattle": { lat: 47.5752, lng: -122.3344, address: "2915 1st Ave S, Seattle" },
  "Supernova|Seattle": { lat: 47.6152, lng: -122.3268, address: "110 Union St, Seattle" },
  "The Crocodile|Seattle": { lat: 47.6133, lng: -122.3430, address: "2505 1st Ave, Seattle" },
  "Neumos|Seattle": { lat: 47.6148, lng: -122.3213, address: "925 E Pike St, Seattle" },
  "Q Nightclub|Seattle": { lat: 47.6143, lng: -122.3215, address: "1426 E Broadway, Seattle" },
  "Barboza|Seattle": { lat: 47.6148, lng: -122.3213, address: "925 E Pike St, Seattle" },

  // === Chicago ===
  "Spybar|Chicago": { lat: 41.8925, lng: -87.6284, address: "646 N Franklin St, Chicago" },
  "Sound-Bar|Chicago": { lat: 41.8901, lng: -87.6318, address: "226 W Ontario St, Chicago" },
  "The Mid|Chicago": { lat: 41.9088, lng: -87.6548, address: "2020 W Fulton St, Chicago" },
  "Radius Chicago|Chicago": { lat: 41.8616, lng: -87.6476, address: "640 W Cermak Rd, Chicago" },
  "Prysm Nightclub|Chicago": { lat: 41.8840, lng: -87.6395, address: "1543 N Kingsbury St, Chicago" },
  "Smart Bar|Chicago": { lat: 41.9396, lng: -87.6590, address: "3730 N Clark St, Chicago" },
  "Primary Nightclub|Chicago": { lat: 41.8976, lng: -87.6545, address: "5 N Sangamon St, Chicago" },
  "Evil Olive|Chicago": { lat: 41.8907, lng: -87.6538, address: "1551 W Division St, Chicago" },
  "Concord Music Hall|Chicago": { lat: 41.9216, lng: -87.6828, address: "2047 N Milwaukee Ave, Chicago" },

  // === Denver ===
  "Temple Denver|Denver": { lat: 39.7536, lng: -104.9981, address: "1136 Broadway, Denver" },
  "Club Vinyl|Denver": { lat: 39.7537, lng: -104.9979, address: "1082 Broadway, Denver" },
  "The Black Box|Denver": { lat: 39.7538, lng: -104.9971, address: "314 E 13th Ave, Denver" },
  "Bar Standard|Denver": { lat: 39.7493, lng: -104.9905, address: "1037 Broadway, Denver" },
  "Cervantes|Denver": { lat: 39.7617, lng: -104.9801, address: "2635 Welton St, Denver" },
  "Mission Ballroom|Denver": { lat: 39.7661, lng: -104.9565, address: "4242 Wynkoop St, Denver" },
  "The Church Nightclub|Denver": { lat: 39.7312, lng: -104.9862, address: "1160 Lincoln St, Denver" },

  // === Detroit ===
  "TV Lounge|Detroit": { lat: 42.3467, lng: -83.0767, address: "2548 Grand River Ave, Detroit" },
  "Magic Stick|Detroit": { lat: 42.3573, lng: -83.0581, address: "4120 Woodward Ave, Detroit" },
  "Marble Bar|Detroit": { lat: 42.3476, lng: -83.0602, address: "1501 Holden St, Detroit" },
  "Spot Lite|Detroit": { lat: 42.3449, lng: -83.0637, address: "2905 Beaufait St, Detroit" },
  "Tangent Gallery|Detroit": { lat: 42.3516, lng: -83.0531, address: "715 E Milwaukee Ave, Detroit" },
  "El Club|Detroit": { lat: 42.3106, lng: -83.0699, address: "4114 W Vernor Hwy, Detroit" },
  "TheEworks|Detroit": { lat: 42.3383, lng: -83.0581, address: "1846 Michigan Ave, Detroit" },

  // === Miami ===
  "Club Space|Miami": { lat: 25.7842, lng: -80.1918, address: "34 NE 11th St, Miami" },
  "E11EVEN|Miami": { lat: 25.7798, lng: -80.1935, address: "29 NE 11th St, Miami" },
  "The Ground|Miami": { lat: 25.7839, lng: -80.1914, address: "34 NE 11th St, Miami" },
  "Do Not Sit On The Furniture|Miami Beach": { lat: 25.7846, lng: -80.1328, address: "423 16th St, Miami Beach" },
  "Treehouse|Miami Beach": { lat: 25.7891, lng: -80.1311, address: "323 23rd St, Miami Beach" },
  "Floyd|Miami": { lat: 25.7856, lng: -80.1909, address: "34 NE 11th St, Miami" },
  "ATV Records|Miami": { lat: 25.7753, lng: -80.1932, address: "1306 N Miami Ave, Miami" },
  "Basement Miami|Miami Beach": { lat: 25.7851, lng: -80.1311, address: "2901 Collins Ave, Miami Beach" },

  // === Atlanta ===
  "Believe Music Hall|Atlanta": { lat: 33.7908, lng: -84.4028, address: "181 Ralph David Abernathy Blvd, Atlanta" },
  "Aisle 5|Atlanta": { lat: 33.7390, lng: -84.3460, address: "1123 Euclid Ave NE, Atlanta" },
  "District|Atlanta": { lat: 33.7556, lng: -84.3765, address: "269 Armour Dr NE, Atlanta" },
  "Ravine|Atlanta": { lat: 33.7549, lng: -84.3655, address: "1021 Peachtree St NE, Atlanta" },
  "Opera Nightclub|Atlanta": { lat: 33.7895, lng: -84.3832, address: "1150 Crescent Ave NE, Atlanta" },

  // === Washington DC ===
  "Flash|Washington": { lat: 38.9163, lng: -77.0232, address: "645 Florida Ave NW, Washington DC" },
  "Soundcheck|Washington": { lat: 38.9216, lng: -77.0225, address: "1420 U St NW, Washington DC" },
  "Echostage|Washington": { lat: 38.9213, lng: -76.9736, address: "2135 Queens Chapel Rd NE, Washington DC" },
  "Eighteenth Street Lounge|Washington": { lat: 38.9102, lng: -77.0426, address: "1212 18th St NW, Washington DC" },

  // === Portland ===
  "45 East|Portland": { lat: 45.5236, lng: -122.6621, address: "45 SE 3rd Ave, Portland" },
  "Holocene|Portland": { lat: 45.5115, lng: -122.6553, address: "1001 SE Morrison St, Portland" },
  "The Liquor Store|Portland": { lat: 45.5229, lng: -122.6652, address: "1001 SE Morrison St, Portland" },
  "Star Theater|Portland": { lat: 45.5258, lng: -122.6722, address: "13 NW 6th Ave, Portland" },
  "Doug Fir Lounge|Portland": { lat: 45.5177, lng: -122.6529, address: "830 E Burnside St, Portland" },
  "Bossanova Ballroom|Portland": { lat: 45.5162, lng: -122.6554, address: "722 E Burnside St, Portland" },

  // === Las Vegas ===
  "Hakkasan|Las Vegas": { lat: 36.1024, lng: -115.1712, address: "3799 S Las Vegas Blvd, Las Vegas" },
  "Omnia|Las Vegas": { lat: 36.1168, lng: -115.1726, address: "3570 S Las Vegas Blvd, Las Vegas" },
  "XS Nightclub|Las Vegas": { lat: 36.1269, lng: -115.1675, address: "3131 S Las Vegas Blvd, Las Vegas" },
  "Marquee Nightclub|Las Vegas": { lat: 36.1091, lng: -115.1733, address: "3708 S Las Vegas Blvd, Las Vegas" },
  "EBC at Night|Las Vegas": { lat: 36.1267, lng: -115.1667, address: "3121 S Las Vegas Blvd, Las Vegas" },

  // === Austin ===
  "Kingdom|Austin": { lat: 30.2611, lng: -97.7376, address: "11th St & Red River St, Austin" },
  "The Concourse Project|Austin": { lat: 30.2227, lng: -97.7469, address: "8509 Burleson Rd, Austin" },
  "Summit|Austin": { lat: 30.2628, lng: -97.7303, address: "120 5th St, Austin" },

  // === Toronto ===
  "CODA|Toronto": { lat: 43.6682, lng: -79.4128, address: "794 Bathurst St, Toronto" },
  "Velvet Underground|Toronto": { lat: 43.6540, lng: -79.3987, address: "508 Queen St W, Toronto" },
  "Toybox|Toronto": { lat: 43.6513, lng: -79.3912, address: "473 Adelaide St W, Toronto" },
  "Nest|Toronto": { lat: 43.6479, lng: -79.3940, address: "423 College St, Toronto" },
  "It'll Do|Toronto": { lat: 43.6503, lng: -79.4003, address: "1220 Queen St W, Toronto" },

  // === Boston ===
  "Bijou Nightclub|Boston": { lat: 42.3505, lng: -71.0627, address: "51 Stuart St, Boston" },
  "Royale|Boston": { lat: 42.3493, lng: -71.0635, address: "279 Tremont St, Boston" },
  "Middle East Downstairs|Cambridge": { lat: 42.3658, lng: -71.1031, address: "472 Massachusetts Ave, Cambridge" },

  // === Phoenix ===
  "Shady Park|Tempe": { lat: 33.4257, lng: -111.9395, address: "26 E University Dr, Tempe" },
  "Monarch Theatre|Phoenix": { lat: 33.4470, lng: -112.0737, address: "122 E Washington St, Phoenix" },
  "Walter Where?House|Phoenix": { lat: 33.4342, lng: -112.0636, address: "702 N 21st Ave, Phoenix" },

  // === Vancouver ===
  "Celebrities Nightclub|Vancouver": { lat: 49.2801, lng: -123.1244, address: "1022 Davie St, Vancouver" },
  "Red Room|Vancouver": { lat: 49.2828, lng: -123.1007, address: "398 Richards St, Vancouver" },
  "Fortune Sound Club|Vancouver": { lat: 49.2795, lng: -123.0991, address: "147 E Pender St, Vancouver" },
  "Open Studios|Vancouver": { lat: 49.2738, lng: -123.1020, address: "122 Powell St, Vancouver" },
};
