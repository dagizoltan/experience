
// scripts/seed_catalonia.js
import { createContainer } from "../src/core/container.js";
import { createKv } from "../src/adapters/kv/index.js";
import { createIds } from "../src/core/ports/ids.js";
import { createClock } from "../src/core/ports/clock.js";
import { createPlaceRepository } from "../src/contexts/discovery/repository.js";

const run = async () => {
  console.log("🌱 Seeding Catalonia Data (Expanded Categories)...");

  // 1. Setup DI
  const container = createContainer();
  const kv = await createKv();

  container.register('kv', () => kv, 'singleton');
  container.register('ids', createIds, 'singleton');
  container.register('clock', createClock, 'singleton');
  container.register('discovery.repository', createPlaceRepository, 'singleton');

  const repo = container.resolve('discovery.repository');

  // 2. Clear DB
  console.log("🧹 Clearing database...");
  await repo.removeAll();

  // 3. Define Real Data (~120 Places)
  // Categories: gastronomy, culture, nature, nightlife, shopping, wellness, education, hidden_gems, family

  const places = [
    // --- CULTURE ---
    { name: "Sagrada Família", lat: 41.4036, lon: 2.1744, cat: 'culture', tags: ['gaudi', 'church', 'unesco'] },
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
    { name: "Santa Maria del Mar", lat: 41.3835, lon: 2.1821, cat: 'culture', tags: ['gothic', 'church'] },
    { name: "Poble Espanyol", lat: 41.3695, lon: 2.1469, cat: 'culture', tags: ['architecture', 'village'] },
    { name: "Arc de Triomf", lat: 41.3911, lon: 2.1806, cat: 'culture', tags: ['monument', 'history'] },
    { name: "Catedral de Girona", lat: 41.9875, lon: 2.8262, cat: 'culture', tags: ['gothic', 'history'] },
    { name: "Jewish Quarter (Girona)", lat: 41.9866, lon: 2.8261, cat: 'culture', tags: ['history', 'medieval'] },
    { name: "Dali Museum", lat: 42.2680, lon: 2.9596, cat: 'culture', tags: ['art', 'surrealism', 'figueres'] },
    { name: "Tossa de Mar Castle", lat: 41.7166, lon: 2.9340, cat: 'culture', tags: ['castle', 'beach'] },
    { name: "Begur Castle", lat: 41.9546, lon: 3.2074, cat: 'culture', tags: ['view', 'medieval'] },
    { name: "Empúries Ruins", lat: 42.1337, lon: 3.1206, cat: 'culture', tags: ['greek', 'roman'] },
    { name: "Amphitheatre of Tarragona", lat: 41.1148, lon: 1.2593, cat: 'culture', tags: ['roman', 'history'] },
    { name: "Pont del Diable", lat: 41.1444, lon: 1.2415, cat: 'culture', tags: ['aqueduct', 'roman'] },
    { name: "Sitges Church", lat: 41.2343, lon: 1.8115, cat: 'culture', tags: ['beach', 'iconic'] },
    { name: "Montserrat Monastery", lat: 41.5931, lon: 1.8375, cat: 'culture', tags: ['mountain', 'monastery'] },
    { name: "Taüll Churches", lat: 42.5190, lon: 0.8499, cat: 'culture', tags: ['romanesque', 'unesco'] },

    // --- GASTRONOMY ---
    { name: "Mercat de la Boqueria", lat: 41.3817, lon: 2.1716, cat: 'gastronomy', tags: ['market', 'food'] },
    { name: "El Xampanyet", lat: 41.3845, lon: 2.1811, cat: 'gastronomy', tags: ['tapas', 'historic'] },
    { name: "Disfrutar", lat: 41.3878, lon: 2.1533, cat: 'gastronomy', tags: ['michelin', 'innovative'] },
    { name: "Tickets", lat: 41.3768, lon: 2.1565, cat: 'gastronomy', tags: ['tapas', 'elbulli'] },
    { name: "Can Culleretes", lat: 41.3807, lon: 2.1743, cat: 'gastronomy', tags: ['historic', 'catalan'] },
    { name: "Els Quatre Gats", lat: 41.3858, lon: 2.1738, cat: 'gastronomy', tags: ['picasso', 'historic'] },
    { name: "7 Portes", lat: 41.3823, lon: 2.1837, cat: 'gastronomy', tags: ['paella', 'historic'] },
    { name: "Quimet & Quimet", lat: 41.3734, lon: 2.1643, cat: 'gastronomy', tags: ['tapas', 'bodega'] },
    { name: "El Celler de Can Roca", lat: 41.9937, lon: 2.8083, cat: 'gastronomy', tags: ['michelin', 'world_best'] },
    { name: "Can Paixano (La Xampanyeria)", lat: 41.3817, lon: 2.1843, cat: 'gastronomy', tags: ['cava', 'tapas'] },
    { name: "Cervecería Catalana", lat: 41.3924, lon: 2.1627, cat: 'gastronomy', tags: ['tapas', 'popular'] },
    { name: "El Nacional", lat: 41.3895, lon: 2.1678, cat: 'gastronomy', tags: ['food_hall', 'beautiful'] },

    // --- NATURE ---
    { name: "Park Güell", lat: 41.4145, lon: 2.1527, cat: 'nature', tags: ['gaudi', 'park', 'unesco'] },
    { name: "Ciutadella Park", lat: 41.3883, lon: 2.1874, cat: 'nature', tags: ['park', 'lake'] },
    { name: "Barceloneta Beach", lat: 41.3784, lon: 2.1925, cat: 'nature', tags: ['beach', 'sea'] },
    { name: "Bogatell Beach", lat: 41.3938, lon: 2.2067, cat: 'nature', tags: ['beach', 'sea'] },
    { name: "Cadaqués", lat: 42.2887, lon: 3.2779, cat: 'nature', tags: ['beach', 'white_village'] },
    { name: "Cap de Creus", lat: 42.3193, lon: 3.3225, cat: 'nature', tags: ['coast', 'hiking'] },
    { name: "Cala Pola", lat: 41.7450, lon: 2.9510, cat: 'nature', tags: ['beach', 'cove'] },
    { name: "Jardins de Cap Roig", lat: 41.8767, lon: 3.1772, cat: 'nature', tags: ['garden', 'botanic'] },
    { name: "Delta de l'Ebre", lat: 40.7245, lon: 0.8164, cat: 'nature', tags: ['park', 'birds'] },
    { name: "Pedraforca", lat: 42.2372, lon: 1.7011, cat: 'nature', tags: ['mountain', 'hiking'] },
    { name: "La Fageda d'en Jordà", lat: 42.1488, lon: 2.5135, cat: 'nature', tags: ['forest', 'volcano'] },
    { name: "Aigüestortes National Park", lat: 42.5690, lon: 0.9423, cat: 'nature', tags: ['park', 'lakes'] },
    { name: "Estany de Banyoles", lat: 42.1197, lon: 2.7578, cat: 'nature', tags: ['lake', 'rowing'] },
    { name: "Vall de Núria", lat: 42.3975, lon: 2.1539, cat: 'nature', tags: ['mountain', 'ski'] },

    // --- NIGHTLIFE ---
    { name: "Magic Fountain of Montjuïc", lat: 41.3712, lon: 2.1517, cat: 'nightlife', tags: ['show', 'lights'] },
    { name: "Razzmatazz", lat: 41.3977, lon: 2.1911, cat: 'nightlife', tags: ['club', 'music'] },
    { name: "Sala Apolo", lat: 41.3744, lon: 2.1695, cat: 'nightlife', tags: ['club', 'concerts'] },
    { name: "Sutton Club", lat: 41.3970, lon: 2.1488, cat: 'nightlife', tags: ['club', 'posh'] },
    { name: "Opium Barcelona", lat: 41.3857, lon: 2.1965, cat: 'nightlife', tags: ['club', 'beach'] },
    { name: "Pacha Barcelona", lat: 41.3855, lon: 2.1969, cat: 'nightlife', tags: ['club', 'beach'] },
    { name: "Paradiso", lat: 41.3837, lon: 2.1824, cat: 'nightlife', tags: ['cocktails', 'speakeasy'] },
    { name: "Dr. Stravinsky", lat: 41.3830, lon: 2.1804, cat: 'nightlife', tags: ['cocktails', 'mixology'] },
    { name: "Bar Marsella", lat: 41.3787, lon: 2.1718, cat: 'nightlife', tags: ['absinthe', 'historic'] },
    { name: "W Hotel", lat: 41.3685, lon: 2.1908, cat: 'nightlife', tags: ['hotel', 'iconic'] },
    { name: "Eclipse Bar", lat: 41.3685, lon: 2.1908, cat: 'nightlife', tags: ['view', 'cocktails'] },
    { name: "La Mirona", lat: 41.9667, lon: 2.7833, cat: 'nightlife', tags: ['concerts', 'girona'] }, // Approx lat/lon

    // --- SHOPPING ---
    { name: "Sant Antoni Market", lat: 41.3788, lon: 2.1630, cat: 'shopping', tags: ['market', 'renovated'] },
    { name: "Passeig de Gràcia", lat: 41.3926, lon: 2.1654, cat: 'shopping', tags: ['luxury', 'brands'] },
    { name: "Portal de l'Àngel", lat: 41.3865, lon: 2.1729, cat: 'shopping', tags: ['highstreet', 'busy'] },
    { name: "La Roca Village", lat: 41.6112, lon: 2.3436, cat: 'shopping', tags: ['outlet', 'brands'] },
    { name: "L'Illa Diagonal", lat: 41.3892, lon: 2.1356, cat: 'shopping', tags: ['mall', 'modern'] },
    { name: "Encants Vells", lat: 41.4010, lon: 2.1862, cat: 'shopping', tags: ['flea_market', 'antiques'] },
    { name: "La Maquinista", lat: 41.4402, lon: 2.1994, cat: 'shopping', tags: ['mall', 'open_air'] },
    { name: "Diagonal Mar", lat: 41.4111, lon: 2.2155, cat: 'shopping', tags: ['mall', 'sea'] },
    { name: "Mercat del Lleó", lat: 41.9818, lon: 2.8228, cat: 'shopping', tags: ['market', 'girona'] },
    { name: "Espai Gironès", lat: 41.9564, lon: 2.7937, cat: 'shopping', tags: ['mall', 'salt'] },
    { name: "Mercat Central de Tarragona", lat: 41.1158, lon: 1.2520, cat: 'shopping', tags: ['market', 'historic'] },

    // --- WELLNESS ---
    { name: "Aire Ancient Baths", lat: 41.3867, lon: 2.1824, cat: 'wellness', tags: ['spa', 'relax'] },
    { name: "Carretera de les Aigües", lat: 41.4172, lon: 2.1150, cat: 'wellness', tags: ['running', 'cycling', 'views'] },
    { name: "Club Natació Atlètic-Barceloneta", lat: 41.3742, lon: 2.1890, cat: 'wellness', tags: ['pool', 'gym', 'sea'] },
    { name: "Banys Àrabs", lat: 41.9872, lon: 2.8258, cat: 'wellness', tags: ['history', 'girona'] }, // Historic but fits
    { name: "Balneari Vichy Catalan", lat: 41.8369, lon: 2.8058, cat: 'wellness', tags: ['spa', 'thermal', 'hotel'] },
    { name: "Magma Centre Lúdic", lat: 41.8596, lon: 2.6625, cat: 'wellness', tags: ['spa', 'thermal'] },
    { name: "Parc de la Creueta del Coll", lat: 41.4184, lon: 2.1466, cat: 'wellness', tags: ['pool', 'relax'] },

    // --- EDUCATION ---
    { name: "University of Barcelona (Historic)", lat: 41.3868, lon: 2.1642, cat: 'education', tags: ['university', 'history'] },
    { name: "Biblioteca de Catalunya", lat: 41.3813, lon: 2.1706, cat: 'education', tags: ['library', 'books'] },
    { name: "CosmoCaixa", lat: 41.4132, lon: 2.1317, cat: 'education', tags: ['science', 'museum'] },
    { name: "Museu Blau", lat: 41.4116, lon: 2.2205, cat: 'education', tags: ['science', 'museum'] },
    { name: "Museu de la Ciència (Terrassa)", lat: 41.5694, lon: 2.0125, cat: 'education', tags: ['industry', 'museum'] },

    // --- HIDDEN GEMS ---
    { name: "Bunker del Carmel", lat: 41.4193, lon: 2.1616, cat: 'hidden_gems', tags: ['view', 'history'] },
    { name: "Jardins de la Tamarita", lat: 41.4114, lon: 2.1360, cat: 'hidden_gems', tags: ['garden', 'quiet'] },
    { name: "Parc del Laberint d'Horta", lat: 41.4391, lon: 2.1458, cat: 'hidden_gems', tags: ['garden', 'maze'] },
    { name: "Cala S'Alguer", lat: 41.8606, lon: 3.1554, cat: 'hidden_gems', tags: ['fishing_village', 'cove'] },
    { name: "Castell de Burriac", lat: 41.5372, lon: 2.3853, cat: 'hidden_gems', tags: ['ruins', 'hike'] },
    { name: "Monestir de Sant Pere de Rodes", lat: 42.3235, lon: 3.1654, cat: 'hidden_gems', tags: ['monastery', 'view'] },
    { name: "Cactus Garden (Montjuïc)", lat: 41.3653, lon: 2.1678, cat: 'hidden_gems', tags: ['plants', 'view'] },

    // --- FAMILY ---
    { name: "Tibidabo Amusement Park", lat: 41.4223, lon: 2.1194, cat: 'family', tags: ['fun', 'view', 'vintage'] },
    { name: "Barcelona Zoo", lat: 41.3860, lon: 2.1895, cat: 'family', tags: ['animals', 'park'] },
    { name: "L'Aquàrium", lat: 41.3770, lon: 2.1843, cat: 'family', tags: ['fish', 'sea'] },
    { name: "PortAventura World", lat: 41.0878, lon: 1.1574, cat: 'family', tags: ['theme_park', 'rollercoasters'] },
    { name: "Catalunya en Miniatura", lat: 41.3608, lon: 1.9961, cat: 'family', tags: ['miniature', 'park'] },
    { name: "Parc de l'Oreneta", lat: 41.4017, lon: 2.1122, cat: 'family', tags: ['train', 'forest'] },
    { name: "Marineland Catalunya", lat: 41.6732, lon: 2.7303, cat: 'family', tags: ['waterpark', 'dolphins'] },
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
