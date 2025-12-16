
// scripts/seed_catalonia.js
import { createContainer } from "../src/core/container.js";
import { createKv } from "../src/adapters/kv/index.js";
import { createIds } from "../src/core/ports/ids.js";
import { createClock } from "../src/core/ports/clock.js";
import { createPlaceRepository } from "../src/contexts/discovery/repository.js";

const run = async () => {
  console.log("🌱 Seeding Catalonia Data...");

  // 1. Setup DI
  const container = createContainer();
  const kv = await createKv(); // Opens default KV

  container.register('kv', () => kv, 'singleton');
  container.register('ids', createIds, 'singleton');
  container.register('clock', createClock, 'singleton');
  container.register('discovery.repository', createPlaceRepository, 'singleton');

  const repo = container.resolve('discovery.repository');

  // 2. Clear DB
  console.log("🧹 Clearing database...");
  await repo.removeAll();

  // 3. Define Real Data (100 Places)
  // Categories: gastronomy, culture, nature, nightlife
  // Tags map for reference:
  // gastronomy: ['tapas', 'paella', 'wine', 'catalan', 'michelin']
  // culture: ['history', 'museum', 'art', 'gaudi', 'architecture']
  // nature: ['beach', 'mountain', 'hiking', 'view']
  // nightlife: ['cocktails', 'pub', 'club', 'music']

  const places = [
    // --- Barcelona (Culture) ---
    { name: "Sagrada Família", lat: 41.4036, lon: 2.1744, cat: 'culture', tags: ['gaudi', 'church', 'unesco'] },
    { name: "Park Güell", lat: 41.4145, lon: 2.1527, cat: 'nature', tags: ['gaudi', 'park', 'unesco'] },
    { name: "Casa Batlló", lat: 41.3917, lon: 2.1649, cat: 'culture', tags: ['gaudi', 'modernisme'] },
    { name: "Casa Milà (La Pedrera)", lat: 41.3954, lon: 2.1620, cat: 'culture', tags: ['gaudi', 'modernisme'] },
    { name: "Picasso Museum", lat: 41.3853, lon: 2.1809, cat: 'culture', tags: ['art', 'museum'] },
    { name: "Camp Nou", lat: 41.3809, lon: 2.1228, cat: 'culture', tags: ['football', 'barca'] },
    { name: "Gothic Quarter", lat: 41.3825, lon: 2.1769, cat: 'culture', tags: ['history', 'old_town'] },
    { name: "Palau de la Música Catalana", lat: 41.3875, lon: 2.1753, cat: 'culture', tags: ['music', 'architecture'] },
    { name: "Cathedral of Barcelona", lat: 41.3840, lon: 2.1762, cat: 'culture', tags: ['gothic', 'church'] },
    { name: "MNAC (National Art Museum)", lat: 41.3686, lon: 2.1534, cat: 'culture', tags: ['art', 'museum', 'view'] },
    { name: "Fundació Joan Miró", lat: 41.3686, lon: 2.1598, cat: 'culture', tags: ['art', 'museum'] },
    { name: "Recinte Modernista de Sant Pau", lat: 41.4124, lon: 2.1744, cat: 'culture', tags: ['hospital', 'architecture'] },
    { name: "Mercat de la Boqueria", lat: 41.3817, lon: 2.1716, cat: 'gastronomy', tags: ['market', 'food'] },
    { name: "Santa Maria del Mar", lat: 41.3835, lon: 2.1821, cat: 'culture', tags: ['gothic', 'church'] },
    { name: "Poble Espanyol", lat: 41.3695, lon: 2.1469, cat: 'culture', tags: ['architecture', 'village'] },
    { name: "Arc de Triomf", lat: 41.3911, lon: 2.1806, cat: 'culture', tags: ['monument', 'history'] },
    { name: "Ciutadella Park", lat: 41.3883, lon: 2.1874, cat: 'nature', tags: ['park', 'lake'] },
    { name: "Magic Fountain of Montjuïc", lat: 41.3712, lon: 2.1517, cat: 'nightlife', tags: ['show', 'lights'] },
    { name: "Tibidabo Amusement Park", lat: 41.4223, lon: 2.1194, cat: 'nightlife', tags: ['fun', 'view'] },
    { name: "CosmoCaixa", lat: 41.4132, lon: 2.1317, cat: 'culture', tags: ['science', 'museum'] },

    // --- Barcelona (Gastronomy/Nightlife) ---
    { name: "El Xampanyet", lat: 41.3845, lon: 2.1811, cat: 'gastronomy', tags: ['tapas', 'historic'] },
    { name: "Bar Marsella", lat: 41.3787, lon: 2.1718, cat: 'nightlife', tags: ['absinthe', 'historic'] },
    { name: "Disfrutar", lat: 41.3878, lon: 2.1533, cat: 'gastronomy', tags: ['michelin', 'innovative'] },
    { name: "Tickets", lat: 41.3768, lon: 2.1565, cat: 'gastronomy', tags: ['tapas', 'elbulli'] },
    { name: "Can Culleretes", lat: 41.3807, lon: 2.1743, cat: 'gastronomy', tags: ['historic', 'catalan'] },
    { name: "Els Quatre Gats", lat: 41.3858, lon: 2.1738, cat: 'gastronomy', tags: ['picasso', 'historic'] },
    { name: "7 Portes", lat: 41.3823, lon: 2.1837, cat: 'gastronomy', tags: ['paella', 'historic'] },
    { name: "Quimet & Quimet", lat: 41.3734, lon: 2.1643, cat: 'gastronomy', tags: ['tapas', 'bodega'] },
    { name: "Razzmatazz", lat: 41.3977, lon: 2.1911, cat: 'nightlife', tags: ['club', 'music'] },
    { name: "Sala Apolo", lat: 41.3744, lon: 2.1695, cat: 'nightlife', tags: ['club', 'concerts'] },
    { name: "Sutton Club", lat: 41.3970, lon: 2.1488, cat: 'nightlife', tags: ['club', 'posh'] },
    { name: "Opium Barcelona", lat: 41.3857, lon: 2.1965, cat: 'nightlife', tags: ['club', 'beach'] },
    { name: "Pacha Barcelona", lat: 41.3855, lon: 2.1969, cat: 'nightlife', tags: ['club', 'beach'] },
    { name: "Paradiso", lat: 41.3837, lon: 2.1824, cat: 'nightlife', tags: ['cocktails', 'speakeasy'] },
    { name: "Dr. Stravinsky", lat: 41.3830, lon: 2.1804, cat: 'nightlife', tags: ['cocktails', 'mixology'] },

    // --- Barcelona (Nature/Views) ---
    { name: "Bunker del Carmel", lat: 41.4193, lon: 2.1616, cat: 'nature', tags: ['view', 'history'] },
    { name: "Montjuïc Castle", lat: 41.3636, lon: 2.1664, cat: 'culture', tags: ['fortress', 'view'] },
    { name: "Barceloneta Beach", lat: 41.3784, lon: 2.1925, cat: 'nature', tags: ['beach', 'sea'] },
    { name: "Bogatell Beach", lat: 41.3938, lon: 2.2067, cat: 'nature', tags: ['beach', 'sea'] },
    { name: "Parc del Laberint d'Horta", lat: 41.4391, lon: 2.1458, cat: 'nature', tags: ['garden', 'maze'] },

    // --- Girona & Costa Brava ---
    { name: "Catedral de Girona", lat: 41.9875, lon: 2.8262, cat: 'culture', tags: ['gothic', 'history'] },
    { name: "El Celler de Can Roca", lat: 41.9937, lon: 2.8083, cat: 'gastronomy', tags: ['michelin', 'world_best'] },
    { name: "Cases de l'Onyar", lat: 41.9850, lon: 2.8242, cat: 'culture', tags: ['river', 'colorful'] },
    { name: "Jewish Quarter (Call)", lat: 41.9866, lon: 2.8261, cat: 'culture', tags: ['history', 'medieval'] },
    { name: "Dali Museum", lat: 42.2680, lon: 2.9596, cat: 'culture', tags: ['art', 'surrealism', 'figueres'] },
    { name: "Cadaqués", lat: 42.2887, lon: 3.2779, cat: 'nature', tags: ['beach', 'white_village'] },
    { name: "Cap de Creus", lat: 42.3193, lon: 3.3225, cat: 'nature', tags: ['coast', 'hiking'] },
    { name: "Tossa de Mar Castle", lat: 41.7166, lon: 2.9340, cat: 'culture', tags: ['castle', 'beach'] },
    { name: "Cala Pola", lat: 41.7450, lon: 2.9510, cat: 'nature', tags: ['beach', 'cove'] },
    { name: "Begur Castle", lat: 41.9546, lon: 3.2074, cat: 'culture', tags: ['view', 'medieval'] },
    { name: "Jardins de Cap Roig", lat: 41.8767, lon: 3.1772, cat: 'nature', tags: ['garden', 'botanic'] },
    { name: "Empúries Ruins", lat: 42.1337, lon: 3.1206, cat: 'culture', tags: ['greek', 'roman'] },

    // --- Tarragona & South ---
    { name: "Amphitheatre of Tarragona", lat: 41.1148, lon: 1.2593, cat: 'culture', tags: ['roman', 'history'] },
    { name: "Circ Romà", lat: 41.1167, lon: 1.2568, cat: 'culture', tags: ['roman', 'history'] },
    { name: "Pont del Diable", lat: 41.1444, lon: 1.2415, cat: 'culture', tags: ['aqueduct', 'roman'] },
    { name: "PortAventura World", lat: 41.0878, lon: 1.1574, cat: 'nightlife', tags: ['theme_park', 'fun'] },
    { name: "Sitges Church", lat: 41.2343, lon: 1.8115, cat: 'culture', tags: ['beach', 'iconic'] },
    { name: "Priorat Wine Region", lat: 41.2167, lon: 0.7833, cat: 'gastronomy', tags: ['wine', 'vineyard'] },
    { name: "Delta de l'Ebre", lat: 40.7245, lon: 0.8164, cat: 'nature', tags: ['park', 'birds'] },

    // --- Central & Pyrenees ---
    { name: "Montserrat Monastery", lat: 41.5931, lon: 1.8375, cat: 'culture', tags: ['mountain', 'monastery'] },
    { name: "Vic Main Square", lat: 41.9300, lon: 2.2544, cat: 'culture', tags: ['market', 'medieval'] },
    { name: "Rupit", lat: 42.0247, lon: 2.4660, cat: 'nature', tags: ['stone_village', 'hiking'] },
    { name: "Pedraforca", lat: 42.2372, lon: 1.7011, cat: 'nature', tags: ['mountain', 'hiking'] },
    { name: "La Fageda d'en Jordà", lat: 42.1488, lon: 2.5135, cat: 'nature', tags: ['forest', 'volcano'] },
    { name: "Besalú Bridge", lat: 42.1996, lon: 2.6994, cat: 'culture', tags: ['medieval', 'bridge'] },
    { name: "Vall de Núria", lat: 42.3975, lon: 2.1539, cat: 'nature', tags: ['mountain', 'ski'] },
    { name: "Aigüestortes National Park", lat: 42.5690, lon: 0.9423, cat: 'nature', tags: ['park', 'lakes'] },
    { name: "Vielha", lat: 42.7005, lon: 0.7947, cat: 'culture', tags: ['mountain', 'aran'] },
    { name: "Taüll Churches", lat: 42.5190, lon: 0.8499, cat: 'culture', tags: ['romanesque', 'unesco'] },
    { name: "Baqueira-Beret", lat: 42.7013, lon: 0.9329, cat: 'nature', tags: ['ski', 'snow'] },
    { name: "Estany de Banyoles", lat: 42.1197, lon: 2.7578, cat: 'nature', tags: ['lake', 'rowing'] },

    // --- More Barcelona / Surrounding ---
    { name: "Colònia Güell", lat: 41.3639, lon: 2.0278, cat: 'culture', tags: ['gaudi', 'crypt'] },
    { name: "Castelldefels Beach", lat: 41.2646, lon: 1.9934, cat: 'nature', tags: ['beach', 'long'] },
    { name: "Monestir de Pedralbes", lat: 41.3957, lon: 2.1126, cat: 'culture', tags: ['gothic', 'monastery'] },
    { name: "Torre Glòries", lat: 41.4036, lon: 2.1895, cat: 'culture', tags: ['modern', 'skyscraper'] },
    { name: "Parc de la Ciutadella", lat: 41.3883, lon: 2.1874, cat: 'nature', tags: ['park', 'relax'] },
    { name: "Museu Blau", lat: 41.4116, lon: 2.2205, cat: 'culture', tags: ['science', 'museum'] },
    { name: "L'Aquàrium", lat: 41.3770, lon: 2.1843, cat: 'nature', tags: ['fish', 'sea'] },
    { name: "Maremagnum", lat: 41.3756, lon: 2.1829, cat: 'nightlife', tags: ['shopping', 'harbor'] },
    { name: "Telefèric del Port", lat: 41.3725, lon: 2.1724, cat: 'nature', tags: ['view', 'cablecar'] },
    { name: "Mirador de Colom", lat: 41.3758, lon: 2.1778, cat: 'culture', tags: ['monument', 'view'] },
    { name: "Estadi Olímpic", lat: 41.3648, lon: 2.1557, cat: 'culture', tags: ['olympics', 'sports'] },
    { name: "Plaça de Catalunya", lat: 41.3870, lon: 2.1700, cat: 'culture', tags: ['center', 'meeting'] },
    { name: "Plaça d'Espanya", lat: 41.3750, lon: 2.1491, cat: 'culture', tags: ['landmark', 'fountain'] },
    { name: "Parc de la Creueta del Coll", lat: 41.4184, lon: 2.1466, cat: 'nature', tags: ['park', 'pool'] },
    { name: "Turó de la Rovira", lat: 41.4194, lon: 2.1617, cat: 'nature', tags: ['view', 'bunkers'] },
    { name: "La Maquinista", lat: 41.4402, lon: 2.1994, cat: 'nightlife', tags: ['shopping', 'mall'] },
    { name: "Glòries Shopping", lat: 41.4055, lon: 2.1906, cat: 'nightlife', tags: ['shopping', 'mall'] },
    { name: "Diagonal Mar", lat: 41.4111, lon: 2.2155, cat: 'nightlife', tags: ['shopping', 'sea'] },
    { name: "Hospital de Sant Pau", lat: 41.4120, lon: 2.1740, cat: 'culture', tags: ['unesco', 'architecture'] },
    { name: "Casa Vicens", lat: 41.4035, lon: 2.1507, cat: 'culture', tags: ['gaudi', 'first'] },
    { name: "Pavelló Mies van der Rohe", lat: 41.3706, lon: 2.1502, cat: 'culture', tags: ['architecture', 'modern'] },
    { name: "CaixaForum", lat: 41.3711, lon: 2.1487, cat: 'culture', tags: ['art', 'factory'] },
    { name: "Passeig de Gràcia", lat: 41.3926, lon: 2.1654, cat: 'nightlife', tags: ['shopping', 'luxury'] },
    { name: "Rambla de Catalunya", lat: 41.3915, lon: 2.1631, cat: 'gastronomy', tags: ['terrace', 'walk'] },
    { name: "La Rambla", lat: 41.3813, lon: 2.1730, cat: 'culture', tags: ['famous', 'walk'] },
    { name: "Port Vell", lat: 41.3780, lon: 2.1850, cat: 'nature', tags: ['harbor', 'boats'] },
    { name: "World Trade Center", lat: 41.3705, lon: 2.1818, cat: 'culture', tags: ['business', 'sea'] },
    { name: "W Hotel", lat: 41.3685, lon: 2.1908, cat: 'nightlife', tags: ['hotel', 'iconic'] },
    { name: "Eclipse Bar", lat: 41.3685, lon: 2.1908, cat: 'nightlife', tags: ['view', 'cocktails'] },
    { name: "Can Paixano (La Xampanyeria)", lat: 41.3817, lon: 2.1843, cat: 'gastronomy', tags: ['cava', 'tapas'] },
    { name: "Cervecería Catalana", lat: 41.3924, lon: 2.1627, cat: 'gastronomy', tags: ['tapas', 'popular'] },
    { name: "El Nacional", lat: 41.3895, lon: 2.1678, cat: 'gastronomy', tags: ['food_hall', 'beautiful'] },
    { name: "Barceloneta Market", lat: 41.3804, lon: 2.1887, cat: 'gastronomy', tags: ['market', 'local'] },
    { name: "Sant Antoni Market", lat: 41.3788, lon: 2.1630, cat: 'gastronomy', tags: ['market', 'renovated'] },
  ];

  // 4. Save to Repo
  let count = 0;
  for (const p of places) {
    const placeEntity = {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [p.lon, p.lat]
      },
      properties: {
        name: p.name,
        category: p.cat,
        tags: p.tags
      }
    };

    await repo.save(placeEntity);
    process.stdout.write('.');
    count++;
  }

  console.log(`\n✅ Seeded ${count} real places!`);
}

run();
