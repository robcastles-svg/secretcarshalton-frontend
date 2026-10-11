/**
 * Permanent redirects from the old WordPress site's addresses that the new
 * site doesn't serve at the same path, so links and search results carry
 * over after the switch. Built (Oct 2026) by checking every address in the
 * live Yoast sitemap plus every old Sabai directory listing against the
 * deployed site; articles, pages, walks/stories categories and most events
 * already match and need nothing here. Old /events?… query links are
 * handled separately in proxy.ts.
 *
 * Order matters: specific entries come before the catch-all patterns.
 */

/** Old event slugs that were renamed when events moved to sc-events (or no longer exist → the events list). */
const EVENTS = {
  "a-wish-for-the-wandle-2": "a-wish-for-the-wandle",
  "autumn-market-at-denbies-wine-estate-2": "autumn-market-at-denbies-wine-estate",
  "beddington-big-day-restoration-tour-at-beddington-farmlands":
    "beddington-big-day-restoration-tour-at-beddington-farmlands-provisional",
  "biznest-markets": "biznest-beddington-park-markets",
  "biznest-wallington-square-weekend-market-2": "biznest-wallington-square-weekend-market",
  "biznest-wallington-square-weekend-market-3": "biznest-wallington-square-weekend-market",
  "boty-i-am-the-sixties-documentary-airs": "boty-i-am-the-sixties-documentary",
  "carshalton-day-of-dance": "carshalton-day-of-dance-2026",
  "carshalton-eco-fair-2025": "carshalton-eco-fair-2026",
  "carshalton-jazz-in-association-with-fitznells-music-a-gala-charity-concert-in-aid-of-ho-integrated-school-project-ghana-featuring-the-nigel-price-quartet-supported-by-fitznells-concert-band":
    "carshalton-jazz-in-association-with-fitznells-music-a-gala-charity-concert",
  "carshalton-jazz-presents-the-phil-allen-quartet": null,
  "carshalton-jazz-summer-festival-2025": "carshalton-jazz-summer-festival",
  "carshalton-lavender-annual-harvest": "carshalton-lavender-annual-harvest-2026",
  "carshalton-record-fair-2": "carshalton-record-fair",
  "charity-classic-super-car-show": "purley-sports-club-charity-classic-super-car-show",
  "kids-camp": null,
  "mozarts-cosi-fab-tutte-presented-by-carshalton-opera": null,
  "mum-baby-toddler-pilates-club-2": "mum-baby-toddler-pilates-club",
  "open-mic-thursday-comedy-at-the-a-robin-hood": "open-mic-thursday-comedy-at-the-robin-hood",
  "rude-science": "rude-science-at-dorking-halls",
  "sipshape-and-create": null,
  "stanley-park-infants-junior-schools-summer-fair": "summer-fair-at-stanley-park-infants-junior-schools",
  "sutton-comic-con": "sutton-comic-con-2025",
  "sutton-open-house-festival-2024": null,
  "swinging-through-time": "swinging-through-time-a-history-of-the-big-band-with-lick-jazz-collective",
  "taste-of-the-caribbean-food-and-drink-festival-stutton": "taste-of-the-caribbean-food-and-drink-festival-sutton",
  "the-queen-of-hearts13th-december-2025": null,
};

/** Old event venues with no page on the new site (no events left there). */
const GONE_VENUES = [
  "carshaltonmethodist-church",
  "raf-biggin-hill-museum-chapel",
  "st-andrews-church",
  "st-marys-church-beddington-park",
];

/** Old event types whose slug changed (null → the events list). */
const EVENT_TYPES = {
  "free-entry": "free",
  "kids-2": "suitable-for-kids",
  other: null,
};

/** Old event "area" types → the area pages. */
const EVENT_AREAS = {
  carshalton: "/whats-on-in-carshalton",
  "sutton-borough": "/whats-on-in-sutton",
  "outside-sutton": "/whats-on-outside-sutton",
};

/** WP Express Checkout map products → the walk that sells them. */
const MAP_PRODUCTS = {
  "coffee-in-the-copse": "theres-a-woodland-cafe-hidden-in-the-surrey-hills-and-you-cant-reach-it-by-car",
  "riddlesdown-common-map": "5-surprising-things-about-riddlesdown-common",
  "seven-sisters-cliffs": "day-trip-to-the-seven-sisters-cliffs-8-mile-circular-walk",
  "shabden-park-estate-walk-map": "chipstead-village-and-shabden-park-farm",
  "wandle-trail-map": "wandle-trail-carshalton-to-morden-hall-via-ravensbury-park-and-watermeads",
  "homes-for-heroes-walk": "iron-age-settlement-and-ww1-homes-for-heroes",
  "denbies-vineyard-circular": "the-stunning-watermill-pub-and-a-wander-around-denbies-vineyard-in-dorking",
};

/** Old Sabai directory categories → new directory categories (or community groups). */
const DIRECTORY_CATEGORIES = {
  accommodation: "/directory/places-to-stay",
  business: "/directory/b2b",
  clubs: "/community/groups",
  entertainment: "/directory/places-to-go",
  "everything-else": "/directory/everything-else",
  families: "/directory/families",
  fitness: "/directory/fitness",
  home: "/directory/house-and-home",
  pets: "/directory/pets",
  trades: "/directory/trades",
  venues: "/directory/venues-for-hire",
};

/** Old Sabai listing slugs that differ from the migrated listing's (null → the directory). */
const DIRECTORY_LISTINGS = {
  "a-voice-for-the-diverse-range-of-arts-in-the-london-borough-of-sutton":
    "arts-network-sutton-a-voice-for-the-diverse-range-of-arts",
  "ambience-home-the-boutique-shop-in-the-heart-of-carshalton-beeches":
    "ambience-home-the-home-and-gift-boutique-shop-in-the-heart-of-carshalton-beeches",
  "beabeaphotography-fine-art-prints-local-london-events-headshots-1":
    "beabeaphotography-fine-art-prints-local-london-events-headshots",
  "berrie-garden-design": "berrie-garden-design-will-give-your-outside-space-a-beautiful-makeover",
  "bold-mama-birth-hypnobirthing-antenatal-classes-postnatal-doula": null,
  "carshalton-lavender": "carshalton-lavender-non-profit-pick-your-own",
  "carshalton-social-club": "carshalton-social-club-function-room",
  "creative-decorative-displays-retail-events": "paperpoms-uk-local-creative-decorative-displays-retail-events",
  "dottys-is-the-most-amazing-place-for-delightful-cream-teas-and-delicious-cakes":
    "dottys-for-the-most-delightful-cream-teas-and-delicious-cakes",
  dramabuds: "dramabuds-fun-drama-song-dance",
  "featured-listing": "featured",
  "freelance-content-copywriter": "find-the-write-words-with-alicia-earls-freelance-content-copywriter",
  "get-a-featured-listing-like-this": "featured",
  "get-a-featured-listing-like-this-5": "featured",
  "home-loving-cats": null,
  "jo-sharpe-artist": "jo-sharpe-artist-original-art-products-and-workshops-inspired-by-nature",
  "local-pub-themed-gifts-featuring-wonderful-carshalton": "stylish-and-unique-carshalton-pub-crawl-gifts-made-by-lazystuff",
  "location-art-prints-scene-in-london": "london-art-prints",
  "love-daniela-stylish-tea-and-coffee-room-located-in-carshalton-beeches":
    "freshly-baked-artisan-bread-treats-at-stylish-love-daniela-cafe",
  mathnasium: "mathnasium-the-maths-learning-centre",
  "mayfield-lavender-fields-for-fabulous-views-n": "mayfield-lavender-fields-for-fabulous-views",
  "milton-hall": "milton-hall-up-to-100-guests",
  "needle-minder-banners-cross-stitch-kits": null,
  "nutritional-therapy": "nutritional-therapy-and-the-food-connection",
  "oru-connect-co-working-space-in-sutton": "oru-space-co-working-in-sutton",
  "personal-branding-and-portrait-photographer-1":
    "stephen-wallace-photography-personal-branding-and-portrait-photographer",
  "professional-wordpress-website-design-and-advice": null,
  "quality-italian-cafe-with-outdoor-seating-in-a-walled-area-of-the-grove-park":
    "sassis-offers-bespoke-italian-coffee-within-the-beautiful-grove-park",
  "robins-next-at-carshalton-athletic-up-to-150-guests": "robins-nest-at-carshalton-athletic-up-to-150-guests",
  "structural-engineer": "just-beams-ltd-structural-engineer",
  "surrey-hills-coffee-in-the-copse": "surrey-hills-cafe-coffee-in-the-copse",
  "the-ginger-italian-restaurant": "the-ginger-italian-carshaltons-1-italian-restaurant-with-live-music",
  "the-hair-sanctuary-hair-salon-carshalton-0208-647-2737": "the-hair-sanctuary-hair-salon-carshalton",
  "the-windsor-castle-pub": "the-windsor-castle-pub-function-room",
};

const r = (source, destination) => ({ source, destination, permanent: true });

export const legacyRedirects = [
  ...Object.entries(EVENTS).map(([from, to]) => r(`/events/${from}`, to ? `/events/${to}` : "/events")),

  ...GONE_VENUES.map((v) => r(`/event-location/${v}`, "/events")),
  r("/event-location/:slug", "/events/venue/:slug"),
  r("/event-organizer/:slug", "/events/organiser/:slug"),
  ...Object.entries(EVENT_TYPES).map(([from, to]) => r(`/event-type/${from}`, to ? `/events/category/${to}` : "/events")),
  r("/event-type/:slug", "/events/category/:slug"),
  ...Object.entries(EVENT_AREAS).map(([from, to]) => r(`/event-type-2/${from}`, to)),
  r("/event-type-2/:slug", "/events"),
  r("/event-user/:id", "/events"),

  ...Object.entries(MAP_PRODUCTS).map(([from, to]) => r(`/ppec-products/${from}`, `/${to}`)),
  r("/ppec-products/:slug", "/walks"),

  r("/tag/:slug", "/themes/:slug"),
  r("/membership-login/:path*", "/login"),

  ...Object.entries(DIRECTORY_CATEGORIES).map(([from, to]) => r(`/directory/categories/${from}`, to)),
  r("/directory/categories/:slug", "/directory"),
  ...Object.entries(DIRECTORY_LISTINGS).map(([from, to]) => r(`/directory/listing/${from}`, `/directory/${to ?? ""}`.replace(/\/$/, ""))),
  r("/directory/listing/:slug", "/directory/:slug"),
];
