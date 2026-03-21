export const siteConfig = {
  name: 'Zentura BV',
  tagline: 'Altijd personeel. Nooit excuses.',
  description: 'Zentura is de vaste back-up partner voor uitzendbureaus in Noord Holland, Friesland en Groningen. Wij leveren gemotiveerde vakmensen wanneer uw bureau het zelf niet kan waarmaken.',
  url: 'https://zentura.nl',

  phone: {
    bussum: '+31617752644',
    heerenveen: '+31613773724',
    display_bussum: '+31 6 177 526 44',
    display_heerenveen: '+31 6 137 737 24',
  },

  email: {
    sales: 'Verkoop@zenturabv.com',
    spoed: 'Spoed@zenturabv.com',
  },

  kvk: '98005375',
  btw: 'NL868321618B01',

  servicegebied: 'Noord Holland, Friesland en Groningen',

  addresses: [
    {
      label: 'Bussum',
      street: 'Torenlaan 5B',
      city: '1402 AT Bussum',
    },
    {
      label: 'Heerenveen',
      street: 'Leeuwarderstraatweg 129',
      city: '8441 PK Heerenveen',
    },
  ],

  navigation: [
    { name: 'Home', href: '/' },
    { name: 'Diensten', href: '/diensten/' },
    { name: 'Tarieven', href: '/tarieven/' },
    { name: 'Over Ons', href: '/over-ons/' },
    { name: 'Contact', href: '/contact/' },
  ],

  diensten: [
    {
      title: 'Laden, lossen en orderpicken',
      description: 'Betrouwbare krachten voor magazijn- en distributiewerk. Van laden en lossen tot precies orderpicken, snel inzetbaar en goed begeleid.',
      icon: 'warehouse',
    },
    {
      title: 'Bezorging en transport',
      description: 'Flexibele bezorgers voor last-mile logistiek. Gemotiveerd, punctueel en gewend aan drukke routes en tijdsdruk.',
      icon: 'truck',
    },
    {
      title: 'Lijnwerk en inpakservice',
      description: 'Handige krachten voor productielijnen en inpakwerkzaamheden. Snel ingewerkt en in staat om een hoog tempo vast te houden.',
      icon: 'conveyor',
    },
    {
      title: 'Events en opbouw',
      description: 'Betrouwbaar eventpersoneel voor opbouw, afbouw, registratie en begeleiding. Presentabel, proactief en stressbestendig.',
      icon: 'events',
    },
    {
      title: 'Schoonmaak en facilitair',
      description: 'Schoonmaakkrachten voor kantoren, horeca en evenementlocaties. Grondig, discreet en op tijd.',
      icon: 'cleaning',
    },
    {
      title: 'Retail support',
      description: 'Flexibele winkelmedewerkers voor drukke periodes, vakantiekrachten of bijspringen bij ziekte. Klantgericht en representatief.',
      icon: 'retail',
    },
    {
      title: 'Verhuizing en ruiming',
      description: 'Sterke krachten voor verhuizingen en ontruimingen. Snel geregeld en zorgvuldig uitgevoerd.',
      icon: 'moving',
    },
    {
      title: 'Agrarisch en seizoenswerk',
      description: 'Seizoenswerkers voor de agrarische sector. Gewend aan buiten werken, vroege diensten en wisselende omstandigheden.',
      icon: 'agri',
    },
    {
      title: 'Horeca support',
      description: 'Keukenhulpen, bedieningspersoneel en runners voor restaurants, hotels en evenementen. Ervaren en representatief.',
      icon: 'horeca',
    },
  ],

  tarieven: [
    {
      naam: 'Standaard',
      prijs: '€30',
      per: 'per uur',
      badge: '',
      description: 'Regulier dagwerk op ma-vr overdag.',
      min_uren: '4 uur minimum',
      opzegtermijn: '24 uur van tevoren',
      voor: 'Structurele inzet, vaste planning',
      kleur: 'wit',
    },
    {
      naam: 'Spoed',
      prijs: '€40',
      per: 'per uur',
      badge: '',
      description: 'Vandaag of morgen iemand nodig? Wij regelen het.',
      min_uren: '4 uur minimum',
      opzegtermijn: 'Binnen 2 uur',
      voor: 'Uitval, onverwachte pieken, noodgevallen',
      kleur: 'oranje',
    },
    {
      naam: 'Nacht en Weekend',
      prijs: '€45',
      per: 'per uur',
      badge: '',
      description: 'Onregelmatige diensten, nachtwerk, weekend.',
      min_uren: '6 uur minimum',
      opzegtermijn: '24 uur van tevoren',
      voor: 'Nachtdiensten, zaterdag, zondag, feestdagen',
      kleur: 'wit',
    },
    {
      naam: 'Project en Vast',
      prijs: '€25',
      per: 'per uur',
      badge: 'Voordeligst',
      description: 'Langdurig traject of vaste plaatsing? Scherpst geprijsd.',
      min_uren: 'Minimaal 3 maanden',
      opzegtermijn: '2 weken',
      voor: 'Langdurige projecten, vaste medewerkers',
      kleur: 'navy',
    },
  ],
};

export type SiteConfig = typeof siteConfig;
