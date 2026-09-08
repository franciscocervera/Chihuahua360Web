const BASE_URL = import.meta.env?.BASE_URL || '/';
const assetUrl = (path) => `${BASE_URL}${path.replace(/^\/+/, '')}`;

export const destinations = [
  {
    id: 'barrancas-cobre',
    title: 'Barrancas del Cobre',
    category: 'Naturaleza',
    short: 'Sistema de cañones, miradores y cultura rarámuri.',
    panorama: assetUrl('assets/panoramas/barrancas-cobre.jpg'),
    thumbnail: assetUrl('assets/thumbnails/barrancas-cobre.jpg'),
    ambientAudio: assetUrl('assets/audio/barrancas-cobre.wav'),
    accent: '#e76f51',
    haptic: 'barrancas-entry',
    hotspots: [
      {
        title: 'Sistema de cañones',
        body: 'Las Barrancas del Cobre reúnen barrancas profundas de la Sierra Tarahumara, con cambios drásticos de altura, clima y vegetación entre los miradores y el fondo de los cañones.',
        yaw: -46,
        pitch: -4,
        haptic: 'barrancas-canones'
      },
      {
        title: 'Presencia rarámuri',
        body: 'La región es territorio de comunidades rarámuri, reconocidas por su vínculo con la sierra, sus carreras tradicionales, textiles, cestería y una vida comunitaria ligada al paisaje.',
        yaw: 42,
        pitch: 3,
        haptic: 'barrancas-raramuri'
      },
      {
        title: 'Divisadero',
        body: 'En la zona de Divisadero convergen miradores, senderos y actividades de aventura con vistas amplias a las barrancas y conexiones hacia Creel, Urique y otros puntos serranos.',
        yaw: 122,
        pitch: -3,
        haptic: 'barrancas-divisadero'
      }
    ]
  },
  {
    id: 'chepe',
    title: 'Tren Chepe',
    category: 'Ruta ferroviaria',
    short: 'Cruce escénico por la Sierra Tarahumara.',
    panorama: assetUrl('assets/panoramas/chepe.jpg'),
    thumbnail: assetUrl('assets/thumbnails/chepe.jpg'),
    ambientAudio: assetUrl('assets/audio/chepe.wav'),
    accent: '#2a9d8f',
    haptic: 'chepe-entry',
    hotspots: [
      {
        title: 'Ruta serrana',
        body: 'El Chepe enlaza el Pacífico con la Sierra Tarahumara mediante un recorrido turístico que atraviesa barrancas, bosques, túneles y puentes de gran valor paisajístico.',
        yaw: -28,
        pitch: -4,
        haptic: 'chepe-ruta'
      },
      {
        title: 'Estaciones clave',
        body: 'Creel, Divisadero y Bahuichivo funcionan como puntos de acceso a miradores, pueblos serranos, hospedaje local y recorridos hacia comunidades y valles cercanos.',
        yaw: 66,
        pitch: 3,
        haptic: 'chepe-estaciones'
      },
      {
        title: 'Viaje panorámico',
        body: 'Las ventanas del tren concentran la experiencia visual: cambios de altitud, curvas entre montañas, bosques de pino y vistas hacia la red de barrancas.',
        yaw: 150,
        pitch: -6,
        haptic: 'chepe-panoramico'
      }
    ]
  },
  {
    id: 'centro-chihuahua',
    title: 'Centro Histórico de Chihuahua',
    category: 'Historia',
    short: 'Catedral, plazas, museos y arquitectura patrimonial.',
    panorama: assetUrl('assets/panoramas/centro-chihuahua.jpg'),
    thumbnail: assetUrl('assets/thumbnails/centro-chihuahua.jpg'),
    ambientAudio: assetUrl('assets/audio/centro-chihuahua.wav'),
    accent: '#f4a261',
    haptic: 'centro-entry',
    hotspots: [
      {
        title: 'Catedral Metropolitana',
        body: 'La Catedral de Chihuahua domina la Plaza de Armas con cantera, torres gemelas y una fachada barroca que marca el corazón simbólico de la capital.',
        yaw: -34,
        pitch: 4,
        haptic: 'centro-catedral'
      },
      {
        title: 'Eje cívico',
        body: 'El Palacio de Gobierno, el Palacio Municipal y los portales del centro concentran vida pública, recorridos peatonales y referencias a episodios de la Independencia y la Revolución.',
        yaw: 82,
        pitch: -4,
        haptic: 'centro-eje'
      },
      {
        title: 'Museos cercanos',
        body: 'Quinta Gameros y Casa Chihuahua amplían la visita con arquitectura, exposiciones y memoria histórica a poca distancia de las plazas principales.',
        yaw: -118,
        pitch: -3,
        haptic: 'centro-museos'
      }
    ]
  },
  {
    id: 'paquime',
    title: 'Paquimé / Casas Grandes',
    category: 'Arqueología',
    short: 'Arquitectura de tierra y patrimonio mundial.',
    panorama: assetUrl('assets/panoramas/paquime.jpg'),
    thumbnail: assetUrl('assets/thumbnails/paquime.jpg'),
    ambientAudio: assetUrl('assets/audio/paquime.wav'),
    accent: '#bc6c25',
    haptic: 'paquime-entry',
    hotspots: [
      {
        title: 'Arquitectura de tierra',
        body: 'Paquimé conserva muros de tierra, plazas, patios y sistemas hidráulicos que muestran una planificación urbana compleja en el desierto chihuahuense.',
        yaw: 24,
        pitch: -2,
        haptic: 'paquime-arquitectura'
      },
      {
        title: 'Intercambio cultural',
        body: 'El sitio fue un punto de contacto entre tradiciones del suroeste de Norteamérica y Mesoamérica, visible en su cerámica, comercio y organización ceremonial.',
        yaw: -76,
        pitch: 4,
        haptic: 'paquime-intercambio'
      },
      {
        title: 'Casas Grandes',
        body: 'El entorno de Casas Grandes complementa la zona arqueológica con talleres artesanales, cerámica regional y una lectura contemporánea del legado paquimense.',
        yaw: 140,
        pitch: -5,
        haptic: 'paquime-casas'
      }
    ]
  },
  {
    id: 'samalayuca',
    title: 'Dunas de Samalayuca',
    category: 'Desierto',
    short: 'Dunas de sílice, viento y horizonte abierto.',
    panorama: assetUrl('assets/panoramas/samalayuca.jpg'),
    thumbnail: assetUrl('assets/thumbnails/samalayuca.jpg'),
    ambientAudio: assetUrl('assets/audio/samalayuca.wav'),
    accent: '#e9c46a',
    haptic: 'samalayuca-entry',
    hotspots: [
      {
        title: 'Mar de arena',
        body: 'Los Médanos de Samalayuca forman un paisaje de dunas claras en el Desierto Chihuahuense, moldeado constantemente por el viento y la luz del norte.',
        yaw: -48,
        pitch: -5,
        haptic: 'samalayuca-arena'
      },
      {
        title: 'Aventura en dunas',
        body: 'El terreno es popular para sandboarding, recorridos 4x4, caminatas fotográficas y observación del cielo en noches despejadas.',
        yaw: 54,
        pitch: 0,
        haptic: 'samalayuca-aventura'
      },
      {
        title: 'Área protegida',
        body: 'El ecosistema combina arena, sierras y vegetación desértica; la visita responsable evita salirse de rutas autorizadas y reduce el impacto sobre flora y fauna.',
        yaw: 130,
        pitch: 3,
        haptic: 'samalayuca-protegida'
      }
    ]
  },
  {
    id: 'creel-arareko',
    title: 'Creel y Lago de Arareko',
    category: 'Sierra',
    short: 'Bosque, lago y puerta de entrada a la Tarahumara.',
    panorama: assetUrl('assets/panoramas/creel-arareko.jpg'),
    thumbnail: assetUrl('assets/thumbnails/creel-arareko.jpg'),
    ambientAudio: assetUrl('assets/audio/creel-arareko.wav'),
    accent: '#588157',
    haptic: 'creel-entry',
    hotspots: [
      {
        title: 'Creel',
        body: 'Creel funciona como base de viaje para la Sierra Tarahumara, con estación del tren, hospedaje, servicios turísticos y acceso a valles, lagos y comunidades cercanas.',
        yaw: -36,
        pitch: -2,
        haptic: 'creel-pueblo'
      },
      {
        title: 'Lago de Arareko',
        body: 'El lago se encuentra rodeado de pinos y formaciones rocosas; es un punto habitual para caminata, fotografía, paseo en lancha y descanso al aire libre.',
        yaw: 70,
        pitch: 3,
        haptic: 'creel-lago'
      },
      {
        title: 'Valles de piedra',
        body: 'Desde Creel se conectan recorridos hacia los valles de los Hongos, las Ranas y los Monjes, además de visitas a San Ignacio Arareko.',
        yaw: 158,
        pitch: -2,
        haptic: 'creel-valles'
      }
    ]
  },
  {
    id: 'basaseachi',
    title: 'Cascada de Basaseachi',
    category: 'Parque nacional',
    short: 'Caída de agua y miradores de la Barranca de Candameña.',
    panorama: assetUrl('assets/panoramas/basaseachi.jpg'),
    thumbnail: assetUrl('assets/thumbnails/basaseachi.jpg'),
    ambientAudio: assetUrl('assets/audio/basaseachi.wav'),
    accent: '#457b9d',
    haptic: 'basaseachi-entry',
    hotspots: [
      {
        title: 'Caída principal',
        body: 'La Cascada de Basaseachi alcanza 246 metros de caída libre y es uno de los emblemas naturales más reconocidos de la Sierra Tarahumara.',
        yaw: 8,
        pitch: -7,
        haptic: 'basaseachi-caida'
      },
      {
        title: 'Barranca de Candameña',
        body: 'El agua desciende hacia la Barranca de Candameña, un entorno de paredes rocosas, bosque de pino-encino y miradores con cambios de perspectiva muy marcados.',
        yaw: -92,
        pitch: 3,
        haptic: 'basaseachi-barranca'
      },
      {
        title: 'Senderos y miradores',
        body: 'Los recorridos del parque combinan senderos cortos, puntos de observación y temporadas de mayor caudal, especialmente después de lluvias en la sierra.',
        yaw: 104,
        pitch: -2,
        haptic: 'basaseachi-senderos'
      }
    ]
  },
  {
    id: 'parral',
    title: 'Hidalgo del Parral',
    category: 'Historia minera',
    short: 'Plata, arquitectura histórica y memoria revolucionaria.',
    panorama: assetUrl('assets/panoramas/parral.jpg'),
    thumbnail: assetUrl('assets/thumbnails/parral.jpg'),
    ambientAudio: assetUrl('assets/audio/parral.wav'),
    accent: '#8d99ae',
    haptic: 'parral-entry',
    hotspots: [
      {
        title: 'Ciudad de la plata',
        body: 'Parral creció alrededor de la minería argentífera y conserva templos, casonas y trazas urbanas asociadas al auge económico del norte novohispano.',
        yaw: -42,
        pitch: -2,
        haptic: 'parral-plata'
      },
      {
        title: 'Palacio Alvarado',
        body: 'El Palacio Alvarado refleja la riqueza minera regional mediante arquitectura señorial, interiores ornamentados y colecciones vinculadas a la vida social de la época.',
        yaw: 62,
        pitch: 3,
        haptic: 'parral-palacio'
      },
      {
        title: 'Memoria de Villa',
        body: 'La historia revolucionaria de Parral se vincula con Francisco Villa y con museos, rutas urbanas y relatos que siguen presentes en la identidad local.',
        yaw: 135,
        pitch: -3,
        haptic: 'parral-villa'
      }
    ]
  },
  {
    id: 'batopilas',
    title: 'Batopilas',
    category: 'Pueblo Mágico',
    short: 'Río, barrancas profundas y antiguo esplendor minero.',
    panorama: assetUrl('assets/panoramas/batopilas.jpg'),
    thumbnail: assetUrl('assets/thumbnails/batopilas.jpg'),
    ambientAudio: assetUrl('assets/audio/batopilas.wav'),
    accent: '#d4a373',
    haptic: 'batopilas-entry',
    hotspots: [
      {
        title: 'Pueblo entre barrancas',
        body: 'Batopilas se ubica en el fondo de una barranca de clima cálido, rodeado por montañas y una ruta de descenso que revela la escala de la Sierra Tarahumara.',
        yaw: -28,
        pitch: -4,
        haptic: 'batopilas-pueblo'
      },
      {
        title: 'Río Batopilas',
        body: 'El río acompaña calles, puentes y áreas de descanso; su presencia explica el nombre rarámuri asociado al “río encajonado”.',
        yaw: 80,
        pitch: 1,
        haptic: 'batopilas-rio'
      },
      {
        title: 'Legado minero',
        body: 'Haciendas, ruinas, templos y caminos recuerdan el auge de la plata y la relación histórica del pueblo con rutas comerciales de la sierra.',
        yaw: -142,
        pitch: -3,
        haptic: 'batopilas-mineria'
      }
    ]
  },
  {
    id: 'sinforosa',
    title: 'Barranca de la Sinforosa',
    category: 'Naturaleza',
    short: 'La Reina de las Barrancas vista desde Guachochi.',
    panorama: assetUrl('assets/panoramas/sinforosa.jpg'),
    thumbnail: assetUrl('assets/thumbnails/sinforosa.jpg'),
    ambientAudio: assetUrl('assets/audio/sinforosa.wav'),
    accent: '#606c38',
    haptic: 'sinforosa-entry',
    hotspots: [
      {
        title: 'Cumbres de Sinforosa',
        body: 'El mirador Cumbres de Sinforosa, cerca de Guachochi, abre una vista amplia hacia una de las barrancas más profundas y escénicas de Chihuahua.',
        yaw: 0,
        pitch: -3,
        haptic: 'sinforosa-cumbres'
      },
      {
        title: 'Río Verde',
        body: 'En el fondo corre el Río Verde, que participa en la red hidrológica serrana y acentúa la profundidad visual de la barranca.',
        yaw: 96,
        pitch: 1,
        haptic: 'sinforosa-rio'
      },
      {
        title: 'Paisaje serrano',
        body: 'La escena combina pino, roca, sombra y niebla estacional; su carácter contemplativo funciona como cierre panorámico del recorrido.',
        yaw: -112,
        pitch: -4,
        haptic: 'sinforosa-paisaje'
      }
    ]
  }
];
