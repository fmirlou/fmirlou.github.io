/*
  Your publications, newest first. This file feeds the Publications page.
  Fields: authors (list), title, venue, volume, number, pages, year, doi (or null),
          type: "article" (journal) or "inproceedings" (conference).
  BibTeX is made from these fields. If a project page already has a hand-written BibTeX for the
  same DOI, that one is used, so the two always agree. Add "pdf" with a link if you have one.
*/
window.PUBLICATIONS = [
  { year: 2025, type: "article", authors: ["M. M. Albay", "E. Akyol", "F. Mirlou", "L. Beker", "M. Kuşcu"],
    title: "Low-cost microfluidic testbed for molecular communications with integrated hydrodynamic gating and screen-printed sensors",
    venue: "IEEE Transactions on Molecular, Biological and Multi-Scale Communications", volume: "11", number: "4", pages: "518", doi: "10.1109/TMBMC.2025.3614382" },
  { year: 2025, type: "article", authors: ["F. Mirlou", "E. Bardakci", "T. Abbasiasl", "L. Beker"],
    title: "A wireless reader for detecting frequency shift of passive sensors",
    venue: "Biosensors and Bioelectronics: X", pages: "100668", doi: "10.1016/j.biosx.2025.100668" },
  { year: 2024, type: "article", authors: ["F. Mirlou", "T. Abbasiasl", "H. Mirzajani", "E. Istif", "M. Akhtar", "C. Cakir", "L. Beker"],
    title: "Continuous glycemic monitoring enabled by a Wi-Fi energy-harvesting wearable sweat-sensing patch",
    venue: "Advanced Materials Technologies", volume: "9", pages: "2301583", doi: "10.1002/admt.202301583" },
  { year: 2024, type: "article", authors: ["T. Abbasiasl", "F. Mirlou", "H. Mirzajani", "et al."],
    title: "A wearable touch-activated device integrated with hollow microneedles for continuous sampling and sensing of dermal interstitial fluid",
    venue: "Advanced Materials", volume: "36", pages: "2304704", doi: "10.1002/adma.202304704" },
  { year: 2023, type: "article", authors: ["F. Mirlou", "L. Beker"],
    title: "Wearable electrochemical sensors for healthcare monitoring: A review of current developments and future prospects",
    venue: "IEEE Transactions on Molecular, Biological and Multi-Scale Communications", volume: "9", pages: "364–373", doi: "10.1109/TMBMC.2023.3304240" },
  { year: 2023, type: "article", authors: ["E. Istif", "H. Mirzajani", "Ç. Dağ", "F. Mirlou", "E. Y. Ozuaciksoz", "C. Cakir", "H. C. Koydemir", "I. Yilgor", "E. Yilgor", "L. Beker"],
    title: "Miniaturized wireless sensor enables real-time monitoring of food spoilage",
    venue: "Nature Food", volume: "4", pages: "427–436", doi: "10.1038/s43016-023-00750-9" },
  { year: 2022, type: "article", authors: ["H. Mirzajani", "T. Abbasiasl", "F. Mirlou", "E. Istif", "M. J. Bathaei", "Ç. Dağ", "O. Deyneli", "D. Yazıcı", "L. Beker"],
    title: "An ultra-compact and wireless tag for battery-free sweat glucose monitoring",
    venue: "Biosensors and Bioelectronics", volume: "213", pages: "114450", doi: "10.1016/j.bios.2022.114450" },
  { year: 2022, type: "article", authors: ["H. Mirzajani", "E. Istif", "T. Abbasiasl", "F. Mirlou", "et al."],
    title: "Femtosecond laser ablation assisted NFC antenna fabrication for smart contact lenses",
    venue: "Advanced Materials Technologies", volume: "7", pages: "2101629", doi: "10.1002/admt.202101629" },
  { year: 2022, type: "article", authors: ["H. Mirzajani", "F. Mirlou", "E. Istif", "R. Singh", "L. Beker"],
    title: "Powering smart contact lenses for continuous health monitoring: Recent advancements and future challenges",
    venue: "Biosensors and Bioelectronics", volume: "197", pages: "113761", doi: "10.1016/j.bios.2021.113761" },
  { year: 2022, type: "article", authors: ["T. Abbasiasl", "F. Mirlou", "E. Istif", "H. C. Koydemir", "L. Beker"],
    title: "A wearable paper-integrated microfluidic device for sequential analysis of sweat based on capillary action",
    venue: "Sensors & Diagnostics", volume: "1", doi: "10.1039/D2SD00032F" },
  { year: 2018, type: "article", authors: ["F. Mirlou", "H. Soofi"],
    title: "Hybrid plasmonic–photonic–organic modulators with low insertion loss and high modulation depth",
    venue: "Journal of Lightwave Technology", volume: "36", number: "12", pages: "2471–2477", doi: "10.1109/JLT.2018.2815898" },
  { year: 2017, type: "inproceedings", authors: ["F. Mirlou", "H. Soofi"],
    title: "Design of an integrated hybrid silicon/EO polymer phase modulator",
    venue: "3rd Iranian Conference on Communications Engineering (ICCE), Tehran", doi: null },
  { year: 2015, type: "inproceedings", authors: ["F. Mirlou", "E. A. A. Miavaghi", "A. R. Ghiasi", "M. Asadollahi"],
    title: "Applying of PID, FPID, TID and ITID controllers on AVR system using particle swarm optimization (PSO)",
    venue: "2nd International Conference on Knowledge-Based Engineering and Innovation (KBEI)", pages: "866–871", doi: "10.1109/KBEI.2015.7436157" }
];
