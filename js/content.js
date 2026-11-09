/*
  All of your content lives in this one file.
  Edit the text, add projects, save, and refresh the page.
  Images go in assets/img/ and are referenced as "assets/img/your-file.jpg".
*/

window.SITE = {
  name: "Fariborz Mirlou",
  role: "Postdoctoral Research Associate, Max Planck Institute for Informatics",
  metaTitle: "Fariborz Mirlou · Wearable and Implantable electronics, sensors and haptics",
  metaDescription: "Postdoctoral research associate at the Max Planck Institute for Informatics. Wearable electronics for sensing and touch: battery-free sensors, flexible readers, microneedle and sweat patches, and haptic interfaces.",
  tagline: "Wearable electronics for sensing and touch, from sweat-sensing patches for biomarkers to haptic interfaces.",

  about: [
    "I design wearable and implantable electronics that read signals from the body: the sensors, the readout circuits, and the power systems that let them run without a battery. My PhD at Koç University focused on a wearable reader platform with power harvesting for continuous health monitoring. Along the way I worked on sweat-sensing patches, smart contact lens electronics and wireless readers for passive sensors.",
    "After my PhD I worked in sensor technologies R&D at Beko Global, where the fabrication design and cleanroom characterization of MEMS temperature and pressure sensors were carried out in a team of five, with almost 700 devices on each silicon wafer.",
    "Since March 2026 I have been a postdoctoral research associate at the Max Planck Institute for Informatics in Saarbrücken, working on wearable haptic systems: vibrotactile hardware, perception studies and movement feedback."
  ],

  facts: [
    { label: "Now", value: "Postdoctoral Research Associate, Max Planck Institute for Informatics" },
    { label: "PhD", value: "Biomedical Sciences and Engineering, Koç University (2024)" },
    { label: "Focus", value: "Wearable and implantable healthcare devices, wearable haptic interfaces, sensors, biomedical devices" }
  ],

  email: "f.mirlou.edu@gmail.com",

  /* Shown under "Contact": what kind of messages you welcome. */
  contactNote: "I am happy to hear from research groups about collaborations, and from students interested in wearable healthcare monitoring, sensing, and haptic interfaces. Email is the best way to reach me.",

  /* Shown in the footer. Change it whenever you edit the site. */
  updated: "November 2026",

  /* The address of the published site, for example "https://yourname.github.io/".
     It is used for the preview card when the link is shared. After changing it,
     run "npm run meta" (see README), or ask Claude to do it. */
  url: "https://fmirlou.github.io",

  /* Paste your Google Scholar profile address here, for example
     "https://scholar.google.com/citations?user=XXXXXXXX". The site shows a
     "Publications" link only when this is filled in. */
  scholar: "https://scholar.google.com/citations?user=7euAHnEAAAAJ&hl=en",

  /* "Skills and tools": one row per group. Keep it short and honest. */
  skills: [
    { group: "Hardware design", items: ["Flexible PCBs", "NFC and RF antennas", "Passive wireless sensors", "Wireless power harvesting", "MEMS sensors", "Embedded electronics", "Haptic drive electronics", "Qualisys (QTM) motion capture"] },
    { group: "Microfabrication and cleanroom", items: ["Laser micromachining", "High-precision 3D printing", "PECVD / CVD", "Parylene C coating", "Maskless lithography", "Mask alignment", "Screen printing", "Profilometry", "Confocal microscopy", "Wet and dry etching"] },
  ],

  links: [] /* add { label: "GitHub", href: "https://..." } entries here */
};

/*
  The story section (education and experience chapters) is built from these lists.
  "when" is shown as written. "note" is optional.
*/
window.SITE.education = [
  { when: "2020 \u2013 2024", title: "Ph.D., Biomedical Sciences and Engineering"},
  { when: "2015 \u2013 2017", title: "M.Sc., Photonics Engineering"},
  { when: "2010 \u2013 2013", title: "B.Sc., Electrical and Electronics Engineering"},
];

window.SITE.experience = [
  { when: "2026 \u2013 now", title: "Postdoctoral Research Associate", where: "Max Planck Institute for Informatics, Saarbrücken",
    note: "Wearable haptic systems: vibrotactile actuator arrays and drive electronics, perception studies, and haptic feedback for movement, including a supernumerary robotic limb." },
  { when: "2024 \u2013 2026", title: "Sensor Technologies R&D, Senior Engineer", where: "Beko Global, Istanbul",
    note: "Led fabrication design and cleanroom characterization of MEMS temperature and pressure sensors in a team of five, with almost 700 sensors per wafer and performance comparable to off-the-shelf products. Part of a team that reached the top eight in the company's Fast Track 2.0 competition, and completed the Six Sigma Green Belt." },
  { when: "2021 \u2013 2026", title: "Cleanroom Researcher", where: "n2STAR, Istanbul",
    note: "Superuser of laser micromachining, PECVD, CVD, Parylene C coating, maskless lithography, mask alignment, profilometry, confocal microscopy, and wet and dry etching benches." },
];

/*
  One object per project. The page for each project is projects/<slug>.html
  and is filled in from the object below.

  model:  which 3D model to show (see src/models.js)
  image:  one photo cropped from the paper, shown beside the 3D model
  hue:    0-360, colour of the soft background behind the 3D model
*/
window.PROJECTS = [
  {
    slug: "supernumerary-limb-haptics",
    title: "Haptic feedback for a supernumerary robotic limb",
    year: 2026,
    status: "In progress",
    venue: "",
    summary: "Vibration on the wearer's arm that follows a robotic limb's motion, so the limb can be felt without looking at it.",
    tags: ["Haptics", "Wearable", "Robotics"],
    hue: 285,
    model: "limb",
    image: "assets/img/projects/supernumerary-limb-haptics.jpg",
    imageAlt: "Photograph of a black robotic arm with servo joints and 3D-printed links, mounted on a wooden board",
    imageCaption: "The robotic arm used in this project.",
    imageCredit: "Photo: Fariborz Mirlou",
    intro: [
      "A supernumerary robotic limb is an additional arm worn on the body. To use it effectively, the wearer must keep track of where it is, which usually means keeping it in sight. This project couples the limb to two vibrotactile actuators (LRAs) on the wearer’s arm that vibrate in step with the limb’s motion, so that its position can be felt rather than watched.",
      "The worn arm moves up and down using servo actuation, 3D-printed parts and embedded control, with a haptic signal chain driving the actuators. The hardware and control are working. A user study with a working-memory task, comparing visual monitoring of the limb with haptic feedback, is in preparation. The work is in progress at the Max Planck Institute for Informatics, so no results are available yet.",
      "The photo shows the robotic arm. The 3D animation is a schematic of the feedback only: two actuators on a forearm, with the vibration shifting from one to the other like a point moving along the skin."
    ],
    sections: [],
    gallery: [],
    links: []
  },
  {
    slug: "molecular-comms-testbed",
    title: "A low-cost testbed for molecular communication",
    year: 2025,
    venue: "IEEE Transactions on Molecular, Biological and Multi-Scale Communications, 2025",
    summary: "A low-cost microfluidic chip that sends information as pH pulses and reads it with a screen-printed sensor.",
    tags: ["Microfluidics", "Sensing"],
    hue: 172,
    model: "testbed",
    image: "assets/img/projects/molecular-comms-testbed.jpg",
    imageAlt: "Photograph of the microfluidic chip with its screen-printed sensor",
    imageCaption: "The microfluidic chip with its screen-printed pH sensor (Fig. 1g of the paper).",
    imageCredit: "Albay et al., IEEE T-MBMSC, 2025",
    intro: [
      "Molecular communication sends information with chemicals instead of radio waves, but lab testbeds are costly and slow to build. This chip costs about $1 and is made in a short time (under 1 hour). A cross-shaped hydrodynamic gate mixes a pH 3 solution into a neutral buffer to make pulses. They travel down a channel to a screen-printed, polyaniline-coated pH sensor. Pulse height and width can be controlled, and the chip carried 4-ary concentration shift keying, with and without intersymbol interference."
    ],
    sections: [],
    gallery: [],
    links: [{ label: "Paper (IEEE Xplore)", href: "https://ieeexplore.ieee.org/abstract/document/11178253" }],
    bibtex: String.raw`@article{albay2025lowcost,
  author  = {Albay, M. M. and Akyol, E. and Mirlou, F. and Beker, L. and Ku{\c{s}}cu, M.},
  title   = {{Low-cost microfluidic testbed for molecular communications with integrated hydrodynamic gating and screen-printed sensors}},
  journal = {IEEE Transactions on Molecular, Biological and Multi-Scale Communications},
  year    = {2025},
  volume  = {11},
  number  = {4},
  pages = {518},
  doi     = {10.1109/TMBMC.2025.3614382}
}`
  },
  {
    slug: "wire-reader",
    title: "WiRe: a wireless reader for passive sensors",
    year: 2025,
    venue: "Biosensors and Bioelectronics: X, 2025",
    summary: "A small flexible reader that replaces the benchtop analyzer for battery-free sensors, and powers itself from a phone.",
    tags: ["Wireless", "Wearable", "Sensing"],
    hue: 222,
    model: "reader",
    image: "assets/img/projects/wire-reader.jpg",
    imageAlt: "Photograph of the fabricated flexible reader held in two hands",
    imageCaption: "The fabricated flexible reader (Fig. 1d of the paper).",
    imageCredit: "Mirlou et al., Biosensors and Bioelectronics: X, 2025",
    intro: [
      "Passive, battery-free sensors are easy to wear or implant, but reading them has needed a benchtop network analyzer. WiRe is a small flexible reader that replaces it. It sweeps 1 to 8 MHz with 100 kHz resolution, picks up the resonance shift of a passive RLC sensor through its own coil, and sends the readings over Bluetooth. It also harvests power from a phone over NFC into a rechargeable battery. With a strain sensor and a pressure sensor it followed small shifts such as a heartbeat, in vitro and in vivo."
    ],
    sections: [],
    gallery: [],
    links: [{ label: "Paper (ScienceDirect)", href: "https://www.sciencedirect.com/science/article/pii/S2590137025000950" }],
    bibtex: String.raw`@article{mirlou2025wire,
  author  = {Mirlou, F. and Bardakci, E. and Abbasiasl, T. and Beker, L.},
  title   = {{A wireless reader for detecting frequency shift of passive sensors}},
  journal = {Biosensors and Bioelectronics: X},
  year    = {2025},
  pages   = {100668},
  doi     = {10.1016/j.biosx.2025.100668}
}`
  },
  {
    slug: "mems-temperature-sensor",
    title: "Fabrication of a MEMS temperature sensor",
    year: 2025,
    venue: "",
    summary: "A micro-fabricated temperature sensor from my work at Beko, from design and cleanroom fabrication to characterization.",
    tags: ["MEMS", "Sensing", "Fabrication"],
    hue: 38,
    model: "mems",
    image: "assets/img/projects/mems-temperature-sensor.jpg",
    imageAlt: "Optical microscope image of the fabricated MEMS temperature sensor: two large contact pads at the top and the patterned sensing structure below",
    imageCaption: "The fabricated sensor under the optical microscope.",
    imageCredit: "Photo: Fariborz Mirlou",
    intro: [
      "At Beko Global, MEMS temperature and pressure sensors were developed in sensor technologies R&D by a team of five, with fabrication design and cleanroom characterizations. Batches reached almost 700 devices per silicon wafer. The image shows one of the temperature sensors from this work under the optical microscope after fabrication.",
      "Two large pads at the top connect to the patterned structure below, which combines long parallel lines with arrays of square openings. The 3D animation is a simplified, generic thin-film process (oxide, metal film, photoresist, exposure through a mask, development, etching and stripping) with a pattern drawn after the photo. It is a schematic, not the exact process flow, and the details of the design, the materials and the measured performance are not shown here."
    ],
    sections: [],
    gallery: [],
    links: []
  },
  {
    slug: "wifi-sweat-patch",
    title: "A Wi-Fi-powered patch for glucose, temperature and heart-rate variability",
    year: 2024,
    venue: "Advanced Materials Technologies, 2024",
    summary: "A flexible patch that tracks sweat glucose, body temperature and HRV, and tops up its battery from 2.45 GHz Wi-Fi.",
    tags: ["Wearable", "Wireless", "Sensing"],
    hue: 18,
    model: "wifi",
    image: "assets/img/projects/wifi-sweat-patch.jpg",
    imageAlt: "Photograph of the patch on the wrist",
    imageCaption: "The patch on the wrist (Fig. 1a of the paper).",
    imageCredit: "Mirlou et al., Advanced Materials Technologies, 2024",
    intro: [
      "Low blood sugar can happen without symptoms, and most wearable glucose sensors do not track heart-rate variability which is an early sign of it. This 4 cm flexible patch measures sweat glucose through a microfluidic channel and a screen-printed sensor, with a limit of detection of 8.9 µM. It also records body temperature and HRV from a red and near-infrared optical module. It harvests 2.45 GHz Wi-Fi energy into a rechargeable battery, sends data over Bluetooth, and was validated in on-body experiments."
    ],
    sections: [],
    gallery: [],
    links: [{ label: "Paper (Wiley)", href: "https://advanced.onlinelibrary.wiley.com/doi/abs/10.1002/admt.202301583" }],
    bibtex: String.raw`@article{mirlou2024wifi,
  author  = {Mirlou, F. and Abbasiasl, T. and Mirzajani, H. and Istif, E. and Akhtar, M. and Cakir, C. and Beker, L.},
  title   = {{Continuous glycemic monitoring enabled by a Wi-Fi energy-harvesting wearable sweat-sensing patch}},
  journal = {Advanced Materials Technologies},
  year    = {2024},
  volume  = {9},
  pages   = {2301583},
  doi     = {10.1002/admt.202301583}
}`
  },
  {
    slug: "microneedle-isf",
    title: "A touch-activated microneedle patch for interstitial fluid",
    year: 2023,
    venue: "Advanced Materials, 2024 (online 2023)",
    summary: "Hollow microneedles and a finger-pressed vacuum chamber that pull ISF from the skin.",
    tags: ["Wearable", "Microfluidics", "Sensing"],
    hue: 340,
    model: "needle",
    image: "assets/img/projects/microneedle-isf.jpg",
    imageAlt: "Photograph of the hollow-microneedle patch held in a gloved hand",
    imageCaption: "The microneedle patch with its electrode lines (Fig. 1e of the paper).",
    imageCredit: "Abbasiasl et al., Advanced Materials, 2024",
    intro: [
      "Interstitial fluid (ISF) under the skin reflects blood chemistry, but it is hard to collect. This patch uses laser-drilled hollow microneedles, in arrays from 3 \u00d7 3 to 9 \u00d7 9, and a soft silicone chamber that works as a pump. Pressing it with a finger and letting go creates a vacuum of about \u221253 kPa through two passive check valves. That draws roughly 2 \u00b5L of fluid per needle per hour into a microfluidic chamber with screen-printed electrodes, which measure glucose and pH. It was tested ex vivo and in animal models."
    ],
    sections: [],
    gallery: [],
    links: [{ label: "Paper (Wiley)", href: "https://advanced.onlinelibrary.wiley.com/doi/full/10.1002/adma.202304704" }],
    bibtex: String.raw`@article{abbasiasl2024microneedle,
  author  = {Abbasiasl, T. and Mirlou, F. and Mirzajani, H. and others},
  title   = {{A wearable touch-activated device integrated with hollow microneedles for continuous sampling and sensing of dermal interstitial fluid}},
  journal = {Advanced Materials},
  year    = {2024},
  volume  = {36},
  pages   = {2304704},
  doi     = {10.1002/adma.202304704}
}`
  },
  {
    slug: "food-spoilage-sensor",
    title: "A wireless sensor that tells when food spoils",
    year: 2023,
    venue: "Nature Food, 2023",
    summary: "A 2 \u00d7 2 cm battery-free sensor that can be read by a phone reads over NFC to tell whether the food is spoiling.",
    tags: ["Wireless", "Sensing", "Fabrication"],
    hue: 118,
    model: "food",
    image: "assets/img/projects/food-spoilage-sensor.jpg",
    imageAlt: "Photograph of the 2 by 2 centimetre sensor held between two gloved fingers",
    imageCaption: "The wireless sensor, 2 \u00d7 2 cm (Fig. 1c of the paper).",
    imageCredit: "Istif et al., Nature Food, 2023",
    intro: [
      "Spoiling meat releases volatile biogenic amines, but measuring them normally needs a laboratory instrument. This 2 \u00d7 2 cm battery-free sensor coats gold interdigitated electrodes (IDEs) with an amine-responsive polymer, poly(styrene-co-maleic anhydride), so its capacitance rises as amines bind. An NFC chip and antenna let a phone read it. Packaged with chicken and beef, it showed an almost 700% change after three days at room temperature and almost none in the freezer."
    ],
    sections: [],
    gallery: [],
    links: [{ label: "Paper (Nature Food)", href: "https://www.nature.com/articles/s43016-023-00750-9" }],
    bibtex: String.raw`@article{istif2023food,
  author  = {Istif, E. and Mirzajani, H. and Da{\u{g}}, {\c{C}}. and Mirlou, F. and Ozuaciksoz, E. Y. and Cakir, C. and Koydemir, H. C. and Yilgor, I. and Yilgor, E. and Beker, L.},
  title   = {{Miniaturized wireless sensor enables real-time monitoring of food spoilage}},
  journal = {Nature Food},
  year    = {2023},
  volume  = {4},
  pages = {427--436},
  doi     = {10.1038/s43016-023-00750-9}
}`
  },
  {
    slug: "glucose-tag",
    title: "A battery-free sweat glucose tag",
    year: 2022,
    venue: "Biosensors and Bioelectronics, 2022",
    summary: "A 0.13 g tag with no battery: a phone powers it over NFC and reads glucose from sweat.",
    tags: ["Wearable", "Wireless", "Sensing"],
    hue: 200,
    model: "tag",
    image: "assets/img/projects/glucose-tag.jpg",
    imageAlt: "Close-up photograph of the glucose tag on skin",
    imageCaption: "The tag on skin (Scheme 1f of the paper).",
    imageCredit: "Mirzajani et al., Biosensors and Bioelectronics, 2022",
    intro: [
      "Athletes with diabetes need glucose readings during exercise, and finger pricks or bulky wearables makes the measurements more challenging. This tag is thin and covers 1.2 cm\u00b2 and weighs 0.13 g. A phone powers and reads it wirelessly, so it needs no battery. It detects glucose down to 24 \u00b5M, matched NMR measurements of sweat, and worked in tests on the body."
    ],
    sections: [],
    gallery: [],
    links: [{ label: "Paper (ScienceDirect)", href: "https://www.sciencedirect.com/science/article/abs/pii/S0956566322004900" }],
    bibtex: String.raw`@article{mirzajani2022tag,
  author  = {Mirzajani, H. and Abbasiasl, T. and Mirlou, F. and Istif, E. and Bathaei, M. J. and Da{\u{g}}, {\c{C}}. and Deyneli, O. and Yaz{\i}c{\i}, D. and Beker, L.},
  title   = {{An ultra-compact and wireless tag for battery-free sweat glucose monitoring}},
  journal = {Biosensors and Bioelectronics},
  year    = {2022},
  volume  = {213},
  pages   = {114450},
  doi     = {10.1016/j.bios.2022.114450}
}`
  },
  {
    slug: "contact-lens-antenna",
    title: "A laser-ablated NFC antenna for smart contact lenses",
    year: 2022,
    venue: "Advanced Materials Technologies, 2022",
    summary: "A femtosecond laser engraves a 12-turn NFC antenna small enough for a contact lens with a glucose sensor.",
    tags: ["Fabrication", "Wireless", "Sensing"],
    hue: 262,
    model: "lens",
    image: "assets/img/projects/contact-lens-antenna.jpg",
    imageAlt: "Photograph of the finished smart contact lens with its antenna, NFC chip and sensor",
    imageCaption: "The finished smart contact lens (Fig. 4d of the paper).",
    imageCredit: "Mirzajani et al., Advanced Materials Technologies, 2022",
    intro: [
      "Smart contact lenses can measure glucose in tears, but the antenna is the largest part and has to fit around the pupil. The paper uses a femtosecond laser to engrave a 12-turn NFC spiral with 35 \u00b5m lines and 10 \u00b5m gaps into the copper of a flexible circuit, without cutting the polyimide beneath. The 19.5 mm\u00b2 antenna kept its frequency within 1% in solution, aging and bending tests. In a PDMS lens with an NFC chip and a glucose sensor, a phone measured 0.2 to 1 mM glucose in artificial tears."
    ],
    sections: [],
    gallery: [],
    links: [{ label: "Paper (Wiley)", href: "https://advanced.onlinelibrary.wiley.com/doi/abs/10.1002/admt.202101629" }],
    bibtex: String.raw`@article{mirzajani2022femtosecond,
  author  = {Mirzajani, H. and Istif, E. and Abbasiasl, T. and Mirlou, F. and others},
  title   = {{Femtosecond laser ablation assisted {NFC} antenna fabrication for smart contact lenses}},
  journal = {Advanced Materials Technologies},
  year    = {2022},
  volume  = {7},
  pages   = {2101629},
  doi     = {10.1002/admt.202101629}
}`
  }
];
