
// scripts/config_harvest.js

export const CATEGORIES = {
  gastronomy: {
    query: `
      nwr["amenity"~"restaurant|cafe|bar|pub|ice_cream"];
    `,
    tags: ["food", "drink"]
  },
  culture: {
    query: `
      nwr["tourism"~"museum|gallery|artwork"];
      nwr["historic"];
      nwr["amenity"="arts_centre"];
      nwr["religion"~"christian|muslim|jewish"] ["tourism"];
    `,
    tags: ["history", "art"]
  },
  sports: {
    query: `
      nwr["leisure"~"stadium|sports_centre|pitch|golf_course"];
      nwr["sport"];
    `,
    tags: ["active", "sport"]
  },
  nature: {
    query: `
      nwr["leisure"~"park|nature_reserve"];
      nwr["natural"~"beach|peak|volcano"];
      nwr["tourism"="viewpoint"];
    `,
    tags: ["outdoors", "view"]
  },
  nightlife: {
    query: `
      nwr["amenity"~"nightclub|bar|pub"];
    `,
    tags: ["party", "night"]
  },
  wellness: {
    query: `
      nwr["leisure"~"spa|sauna"];
      nwr["amenity"="public_bath"];
    `,
    tags: ["relax"]
  }
};

// Full region list for production use (as requested by user)
export const REGIONS = [
  // SPAIN
  { name: "Barcelona_Province", areaId: 3602498642 },
  { name: "Madrid_Province", areaId: 3605326786 },
  { name: "Girona_Province", areaId: 3602416954 },
  { name: "Tarragona_Province", areaId: 3602416960 },
  { name: "Lleida_Province", areaId: 3602416955 },
  { name: "Sevilla_Province", areaId: 3600348987 },
  { name: "Valencia_Province", areaId: 3600055375 },

  // PORTUGAL
  { name: "Lisbon_District", areaId: 3602897100 },
  { name: "Porto_District", areaId: 3604272466 },
  { name: "Faro_District_Algarve", areaId: 3602074558 },

  // FRANCE
  { name: "Paris", areaId: 3600007444 },
  { name: "Pyrenees_Orientales", areaId: 3600007466 },
  { name: "Gironde_Bordeaux", areaId: 3600007405 },
  { name: "Alpes_Maritimes_Nice", areaId: 3600007380 }
];

export const USER_AGENT = "Jules_Discovery_App/1.0 (Harvest)";
