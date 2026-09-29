// Contenu pédagogique « sécurité ferroviaire » piloté par les données : accueil sécurité, points sécurité
// et quiz par métier. Simplifié pour le jeu : seuls les référentiels des entreprises ferroviaires font foi.

/** Équipements proposés lors de l'accueil : l'apprenant choisit ceux qui sont obligatoires. */
export const PPE = [
  { id: "casque", label: "Casque de chantier", icon: "⛑️", required: true },
  { id: "hv", label: "Tenue orange haute visibilité", icon: "🦺", required: true },
  { id: "chaussures", label: "Chaussures de sécurité", icon: "🥾", required: true },
  { id: "gants", label: "Gants de manutention", icon: "🧤", required: true },
  { id: "lunettes", label: "Lunettes de protection", icon: "🥽", required: true },
  { id: "casquette", label: "Casquette", icon: "🧢", required: false },
  { id: "ecouteurs", label: "Écouteurs de musique", icon: "🎧", required: false },
  { id: "sandales", label: "Baskets en toile", icon: "👟", required: false },
];

/** Dialogue d'accueil du chef de chantier (arrivée sur la base travaux). */
export const WELCOME = {
  speaker: "Karim",
  role: "Chef de chantier",
  lines: [
    { text: "Bienvenue sur la base travaux de Valbruche ! Avant de toucher à un engin, on fait l'accueil sécurité. C'est obligatoire pour tout le monde, même pour une visite." },
    { text: "D'abord ta tenue. Choisis les équipements obligatoires pour travailler près des voies.", ppe: true },
    { text: "Regarde la zone rouge au sol : c'est la zone dangereuse. Elle s'étend jusqu'à 1,50 m du rail extérieur quand les trains roulent jusqu'à 160 km/h. On n'y entre jamais sans y être autorisé et protégé.", show: "danger" },
    { text: "Un train peut arriver à tout moment, dans les deux sens, et il met des centaines de mètres à s'arrêter. Il ne peut pas t'éviter : c'est toi qui dois t'écarter.", gesture: "headShake" },
    { text: "On ne traverse les voies qu'aux passages autorisés. On regarde des deux côtés, on traverse perpendiculairement, et on ne marche jamais sur les rails : c'est glissant.", show: "danger" },
    { text: "Quand l'annonceur siffle ou que la radio annonce une circulation, on se dégage tout de suite, sans attendre de voir le train.", gesture: "agree" },
    { text: "C'est bon pour moi. Balade-toi, observe les engins et monte à bord de celui qui t'intéresse. Et reste hors de la zone rouge !", gesture: "agree" },
  ],
};

/** Points sécurité et quiz par métier (id du métier). */
export const SAFETY = {
  train: {
    cards: [
      { icon: "🛑", title: "Le signal fermé", rule: "Un carré ou un sémaphore fermé (feu rouge) impose l'arrêt avant le signal.", why: "Il protège un train, un aiguillage ou un chantier situé derrière." },
      { icon: "🟡", title: "L'avertissement", rule: "Un feu jaune annonce que le prochain signal est fermé : il faut freiner tout de suite pour pouvoir s'arrêter.", why: "Un train de 400 t à 140 km/h a besoin de plus d'un kilomètre pour s'arrêter." },
      { icon: "🖐️", title: "La veille automatique (VACMA)", rule: "Le système demande une action régulière du conducteur. Sans réponse, il déclenche le freinage d'urgence.", why: "Il arrête le train si le conducteur a un malaise." },
      { icon: "📉", title: "La courbe KVB", rule: "Le KVB calcule la vitesse maximale à ne pas dépasser jusqu'au prochain point d'arrêt. S'il est franchi, il freine lui-même.", why: "Il rattrape une erreur humaine avant qu'elle devienne un accident." },
      { icon: "🚧", title: "La limitation temporaire (TIV)", rule: "Un panneau jaune annonce une vitesse limitée pour cause de travaux. Le panneau Z en marque le début, le panneau R la fin.", why: "Des agents travaillent près de la voie et la voie peut être fragilisée." },
    ],
    quiz: [
      { q: "Tu vois un feu jaune fixe. Que fais-tu ?", choices: ["Je garde ma vitesse", "Je freine pour pouvoir m'arrêter au prochain signal", "J'accélère pour passer avant qu'il soit rouge"], answer: 1, explain: "L'avertissement annonce un signal fermé : on prépare l'arrêt immédiatement." },
      { q: "La VACMA sonne. Que se passe-t-il si tu ne réagis pas ?", choices: ["Rien", "Le train freine en urgence", "Le son s'arrête tout seul"], answer: 1, explain: "Sans action du conducteur, la veille déclenche le freinage d'urgence." },
      { q: "Où la limitation temporaire commence-t-elle à s'appliquer ?", choices: ["Au panneau d'annonce", "Au panneau Z", "Au panneau R"], answer: 1, explain: "L'annonce prévient, le Z marque le début et le R la fin, une fois que tout le train l'a dépassé." },
    ],
  },
  pelle: {
    cards: [
      { icon: "📍", title: "Enraillement au point prévu", rule: "L'engin se met sur les rails uniquement au point d'enraillement autorisé, à l'arrêt et aligné.", why: "Ailleurs, les galets peuvent mal se poser et l'engin dérailler." },
      { icon: "⚡", title: "La caténaire 25 000 V", rule: "Le limiteur de hauteur empêche la flèche d'approcher les fils. En circulation, la flèche reste en position transport, basse.", why: "Un arc électrique peut se former sans même toucher le fil." },
      { icon: "🚆", title: "Le gabarit de la voie contiguë", rule: "Si la voie voisine reste en circulation, aucune partie de l'engin ne doit dépasser la limite du gabarit : ni flèche, ni contrepoids.", why: "Un train passe à 100 km/h à moins de deux mètres de la pelle." },
      { icon: "📣", title: "L'annonceur", rule: "Un agent guette les trains et prévient le chantier. À l'annonce, on ramène tout l'équipement côté chantier.", why: "Le conducteur d'engin ne voit pas le train arriver dans son dos." },
      { icon: "🅿️", title: "Frein de parc et stabilité", rule: "On travaille frein serré et on ne circule jamais godet chargé ni flèche levée.", why: "Le centre de gravité monte et l'engin peut basculer." },
    ],
    quiz: [
      { q: "La radio annonce un train sur la voie 2. Ta flèche est au-dessus de la voie 2. Que fais-tu ?", choices: ["Je finis mon godet", "Je ramène immédiatement la flèche côté voie 1", "Je lève la flèche plus haut"], answer: 1, explain: "Le gabarit de la voie 2 doit être libéré tout de suite, avant le passage du train." },
      { q: "À quoi sert le limiteur de hauteur ?", choices: ["À aller plus vite", "À empêcher la flèche d'approcher la caténaire", "À économiser du carburant"], answer: 1, explain: "Il bloque le mouvement vers le haut avant la zone de danger électrique." },
      { q: "Où peut-on enrailler l'engin ?", choices: ["N'importe où sur la ligne", "Au point d'enraillement prévu", "Dans une courbe"], answer: 1, explain: "Seul le point prévu permet un enraillement sûr, aligné et protégé." },
    ],
  },
  nacelle: {
    cards: [
      { icon: "📏", title: "La règle des 3 mètres", rule: "Tant que la caténaire n'est pas consignée et mise à la terre, on ne s'approche jamais à moins de 3 m.", why: "Le 25 000 V peut faire un arc électrique à distance." },
      { icon: "🔒", title: "La consignation", rule: "Le régulateur coupe le courant et confirme par radio. Rien n'est jamais considéré comme coupé sans cette confirmation.", why: "Une ligne peut être réalimentée par erreur." },
      { icon: "🔎", title: "Vérifier l'absence de tension (VAT)", rule: "Avant de toucher, on vérifie avec le détecteur que la tension est bien absente.", why: "La consignation peut concerner la mauvaise section." },
      { icon: "⏚", title: "La mise à la terre (MALT)", rule: "On pose les perches de mise à la terre juste après la VAT. Elles protègent pendant toute l'intervention.", why: "Si le courant revient, il part à la terre et pas dans ton corps." },
      { icon: "🦿", title: "Stabilisateurs et harnais", rule: "Stabilisateurs sortis avant de lever le bras, harnais accroché au panier.", why: "Le panier travaille à plus de 6 m de haut, au-dessus des voies." },
    ],
    quiz: [
      { q: "Dans quel ordre faut-il procéder ?", choices: ["Mise à la terre puis vérification", "Consignation, vérification d'absence de tension, puis mise à la terre", "Intervention directe si le train est passé"], answer: 1, explain: "Consigner, vérifier (VAT), mettre à la terre (MALT) : toujours dans cet ordre." },
      { q: "La ligne n'est pas encore consignée. Jusqu'où peux-tu approcher le panier ?", choices: ["À 50 cm", "Pas à moins de 3 m", "Au contact, avec des gants"], answer: 1, explain: "La règle des 3 m s'applique tant que la mise à la terre n'est pas posée." },
      { q: "Que faut-il faire avant de lever le bras ?", choices: ["Sortir les stabilisateurs", "Couper le moteur", "Rien de spécial"], answer: 0, explain: "Sans stabilisateurs, l'engin peut basculer dès que le bras se déploie." },
    ],
  },
};

/** Messages affichés en exploration à pied (zone dangereuse). */
export const ON_FOOT = {
  enter: "Zone dangereuse : tu es à moins de 1,50 m d'un rail. Recule !",
  train: "Circulation ! Dégage-toi immédiatement de la zone dangereuse.",
  caught: "Tu étais dans la zone dangereuse au passage du train. Dans la réalité, c'est un accident mortel. Retour au point de rassemblement.",
};
