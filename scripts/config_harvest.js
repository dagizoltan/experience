
// scripts/config_harvest.js

export const CATEGORIES = {
  gastronomy: {
    query: `nwr["amenity"~"restaurant|cafe|bar|pub|ice_cream"]`,
    tags: ["food", "drink"]
  }
};

export const COUNTRIES = {
  spain: [
    { name: "Alava", areaId: 3600349013 },
    { name: "Albacete", areaId: 3600349010 },
    { name: "Alicante", areaId: 3600349011 },
    { name: "Almeria", areaId: 3600349045 },
    { name: "Asturias", areaId: 3600349033 },
    { name: "Avila", areaId: 3600349019 },
    { name: "Badajoz", areaId: 3600348995 },
    { name: "Baleares", areaId: 3600349038 },
    { name: "Barcelona", areaId: 3602498642 },
    { name: "Burgos", areaId: 3600349017 },
    { name: "Caceres", areaId: 3600348998 },
    { name: "Cadiz", areaId: 3600349043 },
    { name: "Cantabria", areaId: 3600349014 },
    { name: "Castellon", areaId: 3600349015 },
    { name: "Ciudad_Real", areaId: 3600349009 },
    { name: "Cordoba", areaId: 3600349042 },
    { name: "Coruna", areaId: 3600348983 },
    { name: "Cuenca", areaId: 3600349007 },
    { name: "Girona", areaId: 3602416954 },
    { name: "Granada", areaId: 3600349046 },
    { name: "Guadalajara", areaId: 3600349008 },
    { name: "Guipuzcoa", areaId: 3600349027 },
    { name: "Huelva", areaId: 3600348986 },
    { name: "Huesca", areaId: 3600349005 },
    { name: "Jaen", areaId: 3600349041 },
    { name: "Leon", areaId: 3600349020 },
    { name: "Lleida", areaId: 3602416955 },
    { name: "Lugo", areaId: 3600348985 },
    { name: "Madrid", areaId: 3605326786 },
    { name: "Malaga", areaId: 3600349044 },
    { name: "Murcia", areaId: 3600349047 },
    { name: "Navarra", areaId: 3600349004 },
    { name: "Ourense", areaId: 3600348984 },
    { name: "Palencia", areaId: 3600349018 },
    { name: "Las_Palmas", areaId: 3600349039 },
    { name: "Pontevedra", areaId: 3600348982 },
    { name: "La_Rioja", areaId: 3600349003 },
    { name: "Salamanca", areaId: 3600349022 },
    { name: "Santa_Cruz_de_Tenerife", areaId: 3600349040 },
    { name: "Segovia", areaId: 3600349023 },
    { name: "Sevilla", areaId: 3600348987 },
    { name: "Soria", areaId: 3600349024 },
    { name: "Tarragona", areaId: 3602416960 },
    { name: "Teruel", areaId: 3600349006 },
    { name: "Toledo", areaId: 3600349012 },
    { name: "Valencia", areaId: 3600055375 },
    { name: "Valladolid", areaId: 3600349021 },
    { name: "Vizcaya", areaId: 3600349028 },
    { name: "Zamora", areaId: 3600349025 },
    { name: "Zaragoza", areaId: 3600349026 }
  ],
  portugal: [
    { name: "Aveiro", areaId: 3604272467 },
    { name: "Beja", areaId: 3602074551 },
    { name: "Braga", areaId: 3604156683 },
    { name: "Braganca", areaId: 3604156684 },
    { name: "Castelo_Branco", areaId: 3602897108 },
    { name: "Coimbra", areaId: 3602914757 },
    { name: "Evora", areaId: 3602074557 },
    { name: "Faro", areaId: 3602074558 },
    { name: "Guarda", areaId: 3602897105 },
    { name: "Leiria", areaId: 3602897102 },
    { name: "Lisboa", areaId: 3602897100 },
    { name: "Portalegre", areaId: 3602897107 },
    { name: "Porto", areaId: 3604272466 },
    { name: "Santarem", areaId: 3602897106 },
    { name: "Setubal", areaId: 3602074552 },
    { name: "Viana_do_Castelo", areaId: 3604156681 },
    { name: "Vila_Real", areaId: 3604156685 },
    { name: "Viseu", areaId: 3602897103 }
  ]
};

export const USER_AGENT = "Jules_Discovery_App/2.0 (Harvest)";
