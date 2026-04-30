import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, ChevronDown, ChevronUp, Clock } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { cn } from '../lib/cn'

type TechCategory = 'knifeSkills' | 'heatMethods' | 'sauces' | 'baking' | 'prep'
type Difficulty   = 'beginner' | 'intermediate' | 'advanced'

interface Technique {
  name: string; nameEl?: string
  category: TechCategory; difficulty: Difficulty; time: number
  description: string; descriptionEl: string
  tips: string[]; tipsEl: string[]
}

const TECHNIQUES: Technique[] = [
  {
    name: 'Julienne',
    category: 'knifeSkills', difficulty: 'beginner', time: 10,
    description: 'Cut vegetables into thin, uniform matchstick strips (3 mm × 3 mm × 6 cm). Square the vegetable first, slice into planks, then into sticks.',
    descriptionEl: 'Κόβω λαχανικά σε λεπτές, ομοιόμορφες ράβδους σαν σπίρτα (3 mm × 3 mm × 6 cm). Τετραγωνίζω πρώτα το λαχανικό, κόβω σε φέτες και κατόπιν σε ράβδους.',
    tips: ['Square off the sides first for consistent planks', 'Keep strips parallel and the same length', 'A sharp knife and a flat stable surface are essential'],
    tipsEl: ['Τετραγωνίστε πρώτα τις πλευρές για ομοιόμορφες φέτες', 'Κρατήστε τις ράβδους παράλληλες και με ίδιο μήκος', 'Κοφτερό μαχαίρι και σταθερή επιφάνεια είναι απαραίτητα'],
  },
  {
    name: 'Chiffonade',
    category: 'knifeSkills', difficulty: 'beginner', time: 5,
    description: 'Stack leafy herbs (basil, mint, sage) largest to smallest, roll tightly into a cylinder, and slice crosswise into thin ribbons.',
    descriptionEl: 'Στοιβάζω φυλλώδη μυρωδικά (βασιλικό, μέντα, φασκόμηλο) από το μεγαλύτερο στο μικρότερο, τυλίγω σφιχτά σε κύλινδρο και κόβω κάθετα σε λεπτές κορδέλες.',
    tips: ['Roll tightly to prevent uneven cuts', 'Use immediately — basil oxidises to black within minutes', 'Works equally well for larger leaves like chard or cabbage'],
    tipsEl: ['Τυλίξτε σφιχτά για ομοιόμορφη κοπή', 'Χρησιμοποιήστε αμέσως — ο βασιλικός μαυρίζει από οξείδωση σε λίγα λεπτά', 'Δουλεύει εξίσου καλά σε μεγαλύτερα φύλλα όπως σέσκουλο ή λάχανο'],
  },
  {
    name: 'Brunoise',
    category: 'knifeSkills', difficulty: 'intermediate', time: 20,
    description: 'Fine dice of vegetables into 1–3 mm cubes. First julienne the vegetable, then rotate 90° and cut across the sticks.',
    descriptionEl: 'Λεπτή κοπή λαχανικών σε κύβους 1–3 mm. Πρώτα κόβω ζυλιέν, κατόπιν στρέφω 90° και κόβω κάθετα στις ράβδους.',
    tips: ['Square off all four sides first for uniform planks', 'Keep the "claw" grip throughout to protect fingers', 'A very sharp knife reduces crushing and bruising'],
    tipsEl: ['Τετραγωνίστε και τις τέσσερις πλευρές για ομοιόμορφες φέτες', 'Διατηρήστε "νύχι" στήριξης καθ\'όλη τη διαδικασία για προστασία', 'Πολύ κοφτερό μαχαίρι μειώνει τη ταλαιπωρία του λαχανικού'],
  },
  {
    name: 'Tourné',
    category: 'knifeSkills', difficulty: 'advanced', time: 30,
    description: 'A 7-sided, football-shaped vegetable cut carved with a curved tourné knife. A classic French knife-skill test and fine-dining presentation cut.',
    descriptionEl: 'Κλασικό γαλλικό σχήμα 7 πλευρών σαν αμερικανικό ποδόσφαιρο, σκαλισμένο με καμπύλο τουρνέ μαχαίρι. Κλασική δοκιμασία μαχαιρικής δεξιότητας.',
    tips: ['Use a paring or dedicated tourné knife — never a chef\'s knife', 'Aim for 7 equal concave faces tapering to flat ends', 'Practise on carrots or potatoes — consistency takes time'],
    tipsEl: ['Χρησιμοποιήστε μαχαίρι τουρνέ — ποτέ μαχαίρι σεφ', 'Στοχεύστε σε 7 ίσες κοίλες πλευρές που ταπεινώνουν σε επίπεδα άκρα', 'Εξασκηθείτε σε καρότα ή πατάτες — η συνέπεια απαιτεί χρόνο'],
  },
  {
    name: 'Knife Sharpening',
    nameEl: 'Ακόνισμα Μαχαιριού',
    category: 'knifeSkills', difficulty: 'beginner', time: 10,
    description: 'A honing steel realigns the blade edge between uses (daily). A whetstone removes metal to restore a dull edge (weekly or monthly).',
    descriptionEl: 'Χάλυβας ακονίσματος ευθυγραμμίζει τη λεπίδα μεταξύ χρήσεων (καθημερινά). Ακόνι αφαιρεί μέταλλο για αποκατάσταση μουντής λεπίδας (εβδομαδιαία ή μηνιαία).',
    tips: ['Hone before every use; sharpen when honing no longer restores performance', 'Hold the blade at 15–20° to the whetstone and maintain the angle consistently', 'Push into the stone on the sharpening stroke; pull back lightly'],
    tipsEl: ['Ακονίστε πριν κάθε χρήση· τροχίστε όταν το ακόνισμα δεν αποκαθιστά πλέον την απόδοση', 'Κρατήστε τη λεπίδα σε γωνία 15–20° στο ακόνι και διατηρήστε τη γωνία σταθερή', 'Ωθήστε προς το ακόνι στη διαδρομή ακονίσματος· τραβήξτε ελαφρά πίσω'],
  },
  {
    name: 'Searing',
    nameEl: 'Καψάλισμα',
    category: 'heatMethods', difficulty: 'beginner', time: 10,
    description: 'High-heat dry cooking to develop a brown Maillard crust on protein. Requires a very hot pan, a completely dry surface, and patience — do not move the food.',
    descriptionEl: 'Ψήσιμο σε δυνατή ξηρή φωτιά για ανάπτυξη καφετί κρούστας Maillard. Απαιτεί πολύ καυτό τηγάνι, εντελώς στεγνή επιφάνεια και υπομονή — μην κουνάτε το φαγητό.',
    tips: ['Pat protein completely dry before searing — moisture prevents browning', 'The pan must be preheated until lightly smoking', 'Food releases naturally when the crust is formed — if it sticks, wait'],
    tipsEl: ['Στεγνώστε τελείως την πρωτεΐνη πριν — η υγρασία αποτρέπει το ροδίσιμο', 'Το τηγάνι πρέπει να είναι προθερμασμένο μέχρι να καπνίσει ελαφρά', 'Το φαγητό αποκολλάται μόνο του όταν σχηματιστεί η κρούστα — αν κολλάει, περιμένετε'],
  },
  {
    name: 'Braising',
    nameEl: 'Μπρεζάρισμα',
    category: 'heatMethods', difficulty: 'beginner', time: 15,
    description: 'Two-stage method: sear for colour and flavour, then slow-cook covered in a small amount of aromatic liquid at 150–160°C. Breaks down collagen into gelatin.',
    descriptionEl: 'Δίφασος τρόπος: ροδίζω για χρώμα και γεύση, κατόπιν σιγομαγειρεύω σκεπαστό σε λίγο αρωματικό υγρό στους 150–160°C. Μετατρέπει το κολλαγόνο σε ζελατίνη.',
    tips: ['Liquid should reach no more than ⅓ up the side of the meat', 'Maintain a bare simmer — boiling makes meat tough', 'Reduce the braising liquid after removing the meat for your sauce'],
    tipsEl: ['Το υγρό δεν πρέπει να ξεπερνά το ⅓ του ύψους του κρέατος', 'Διατηρήστε ελαφρύ βρασμό — έντονο βράσιμο σκληραίνει το κρέας', 'Μειώστε το υγρό μπρεζαρίσματος μετά την αφαίρεση του κρέατος για σάλτσα'],
  },
  {
    name: 'Confit',
    category: 'heatMethods', difficulty: 'intermediate', time: 20,
    description: 'Slow-cook food fully submerged in fat at a controlled 80–90°C for several hours. Results in silky, deeply flavoured meat that crisps beautifully when seared to finish.',
    descriptionEl: 'Σιγομαγειρεύω βυθισμένο σε λίπος στους ελεγχόμενους 80–90°C για αρκετές ώρες. Αποτέλεσμα: μεταξένιο, βαθιά αρωματικό κρέας που τσιγαρίζεται υπέροχα για φινίρισμα.',
    tips: ['Temperature control is critical — use a probe thermometer in the fat', 'Salt and cure the protein overnight before confiting for best flavour', 'Confit submerged in fat keeps in the fridge for 2–3 weeks'],
    tipsEl: ['Ο έλεγχος θερμοκρασίας είναι κρίσιμος — χρησιμοποιήστε θερμόμετρο στο λίπος', 'Αλατίστε και κάντε marinade τη νύχτα πριν για καλύτερη γεύση', 'Confit βυθισμένο σε λίπος συντηρείται στο ψυγείο 2–3 εβδομάδες'],
  },
  {
    name: 'Poaching',
    nameEl: 'Ποσάρισμα',
    category: 'heatMethods', difficulty: 'beginner', time: 10,
    description: 'Gentle cooking submerged in liquid held just below a simmer (70–80°C). Ideal for eggs, fish, chicken breast, and fruit. Preserves moisture and delicate texture.',
    descriptionEl: 'Απαλό μαγείρεμα βυθισμένο σε υγρό στους 70–80°C (κάτω από βρασμό). Ιδανικό για αβγά, ψάρι, στήθος κοτόπουλου και φρούτα. Διατηρεί υγρασία και λεπτή σύσταση.',
    tips: ['Maintain temperature — never let the liquid boil; it will toughen proteins', 'Add a splash of white wine vinegar to egg-poaching water to help whites hold together', 'A deep pan gives better results for eggs than a wide, shallow skillet'],
    tipsEl: ['Διατηρήστε θερμοκρασία — ποτέ μη αφήσετε να βράσει· ο βρασμός σκληραίνει τις πρωτεΐνες', 'Προσθέστε λίγο ξύδι λευκού κρασιού για τα αβγά ώστε να κρατηθεί το ασπράδι', 'Βαθύ τηγάνι δίνει καλύτερα αποτελέσματα για αβγά από φαρδύ, ρηχό'],
  },
  {
    name: 'Sweating Aromatics',
    nameEl: 'Σβήσιμο Αρωματικών',
    category: 'heatMethods', difficulty: 'beginner', time: 8,
    description: 'Cook mirepoix or other aromatics in fat over low-medium heat until soft, translucent, and fragrant — without any browning. Builds the flavour base of most sauces and soups.',
    descriptionEl: 'Μαγειρεύω μιρεπουά ή αρωματικά σε λίπος σε χαμηλή φωτιά μέχρι να μαλακώσουν και να γίνουν διαφανή και αρωματικά — χωρίς ροδίσιμο. Χτίζει τη βάση γεύσης.',
    tips: ['Low heat is key — any browning changes the flavour profile', 'Salt the vegetables at the start to draw out moisture and speed softening', 'A lid placed half-on creates a gentle steaming effect'],
    tipsEl: ['Χαμηλή φωτιά είναι κλειδί — το ροδίσιμο αλλάζει το προφίλ γεύσης', 'Αλατίστε στην αρχή τα λαχανικά για να βγάλουν υγρασία γρηγορότερα', 'Καπάκι στη μέση δημιουργεί ήπιο εφέ ατμού'],
  },
  {
    name: 'En Papillote',
    nameEl: 'Ε Παπιγιότ',
    category: 'heatMethods', difficulty: 'beginner', time: 15,
    description: 'Bake food sealed inside a parchment or foil parcel with aromatics and a small amount of liquid. The trapped steam gently cooks the food and concentrates flavours.',
    descriptionEl: 'Ψήνω φαγητό σφραγισμένο σε λαδόκολλα ή αλουμινόχαρτο με αρωματικά και λίγο υγρό. Ο εγκλωβισμένος ατμός μαγειρεύει απαλά και συγκεντρώνει τις γεύσεις.',
    tips: ['Seal the parcel tightly — escaping steam means lost moisture', 'Lay aromatics directly on and under the protein', 'Open parcels carefully at the table — the rush of steam can cause burns'],
    tipsEl: ['Σφραγίστε καλά — ο διαφεύγων ατμός σημαίνει χαμένη υγρασία', 'Τοποθετήστε τα αρωματικά απευθείας πάνω και κάτω από την πρωτεΐνη', 'Ανοίξτε προσεχτικά — η ορμή ατμού μπορεί να προκαλέσει εγκαύματα'],
  },
  {
    name: 'Roux',
    category: 'sauces', difficulty: 'beginner', time: 15,
    description: 'Equal parts butter and flour cooked together to form the thickening base for classical sauces. White roux (2 min), blonde roux (5 min), brown roux (10+ min) — each adds different flavour.',
    descriptionEl: 'Ίσα μέρη βουτύρου και αλευριού μαγειρεμένα μαζί για βάση πάχυνσης κλασικών σάλτσων. Λευκό ρου (2 λεπτά), ξανθό (5 λεπτά), καφέ (10+ λεπτά) — κάθε ένα προσφέρει διαφορετική γεύση.',
    tips: ['Cook out the raw flour taste for at least 2 minutes', 'Add liquid gradually, whisking constantly to prevent lumps', 'Cold liquid into hot roux, or hot liquid into cold roux — either works; never both hot'],
    tipsEl: ['Μαγειρέψτε για τουλάχιστον 2 λεπτά για να φύγει η γεύση ωμού αλευριού', 'Προσθέστε υγρό σταδιακά, ανακατεύοντας συνεχώς για αποφυγή σβώλων', 'Κρύο υγρό σε ζεστό ρου ή ζεστό σε κρύο — και τα δύο δουλεύουν· ποτέ και τα δύο ζεστά'],
  },
  {
    name: 'Emulsion Sauces',
    nameEl: 'Σάλτσες Γαλακτωματοποίησης',
    category: 'sauces', difficulty: 'intermediate', time: 20,
    description: 'Combine oil and a water-based liquid using an emulsifier. Temporary (vinaigrette), semi-permanent (mayonnaise), or heat-set (hollandaise). The emulsifier coats fat droplets to hold them suspended.',
    descriptionEl: 'Συνδυάζω λάδι και υγρό με βάση νερό χρησιμοποιώντας γαλακτωματοποιητή. Προσωρινές (βινεγκρέτ), ημιμόνιμες (μαγιονέζα) ή θερμοσταθερές (ολανδέζ). Ο γαλακτωματοποιητής επικαλύπτει τα σταγονίδια λαδιού.',
    tips: ['Add fat very slowly at the start to establish the emulsion', 'For hollandaise: keep the bain-marie below 65°C — overheating scrambles the yolks', 'A broken sauce can often be rescued: start fresh with a new yolk and slowly whisk in the broken sauce'],
    tipsEl: ['Προσθέστε λίπος πολύ αργά στην αρχή για να δημιουργηθεί η γαλακτωμάτωση', 'Για ολανδέζ: κρατήστε το μπεν-μαρί κάτω από 65°C — υπερθέρμανση ψήνει τους κρόκους', 'Κομμένη σάλτσα μπορεί να σωθεί: ξεκινήστε με νέο κρόκο και προσθέστε αργά την κομμένη'],
  },
  {
    name: 'Reduction',
    nameEl: 'Μείωση',
    category: 'sauces', difficulty: 'beginner', time: 10,
    description: 'Simmer a liquid until its volume decreases through evaporation — concentrating flavour and achieving the desired consistency.',
    descriptionEl: 'Σιγοβράζω υγρό μέχρι να μειωθεί ο όγκος του μέσω εξάτμισης — συγκεντρώνει τη γεύση και επιτυγχάνει την επιθυμητή πυκνότητα.',
    tips: ['Wide, shallow pans reduce faster than tall, narrow pots', 'Season only after reducing to avoid over-salting', 'Check consistency with the nappe test: dip a spoon and draw a line — if it holds, the sauce is ready'],
    tipsEl: ['Φαρδιά, ρηχά τηγάνια μειώνονται πιο γρήγορα από ψηλές, στενές κατσαρόλες', 'Αλατίστε μόνο μετά τη μείωση για να αποφύγετε υπερ-αλάτισμα', 'Ελέγξτε σύσταση με δοκιμή nappe: βυθίστε κουτάλι και τραβήξτε γραμμή — αν κρατάει, είναι έτοιμη'],
  },
  {
    name: 'Monter au Beurre',
    nameEl: 'Μοντέ ο Μπέρ',
    category: 'sauces', difficulty: 'intermediate', time: 5,
    description: 'Whisk cold butter pieces into a finished hot sauce off the heat to add richness, a glossy sheen, and silky body — without thickening with flour.',
    descriptionEl: 'Ανακατεύω κομμάτια κρύου βουτύρου σε έτοιμη ζεστή σάλτσα μακριά από τη φωτιά για πλούτο, γυαλάδα και μεταξένιο σώμα — χωρίς αλεύρι.',
    tips: ['Butter must be cold from the fridge — room-temperature butter will break the sauce', 'Remove the pan from heat before adding butter', 'Whisk or swirl rapidly; do not return to the boil after mounting'],
    tipsEl: ['Το βούτυρο πρέπει να είναι κρύο από το ψυγείο — σε θερμοκρασία δωματίου σπάει τη σάλτσα', 'Αφαιρέστε από τη φωτιά πριν προσθέσετε το βούτυρο', 'Ανακατεύετε γρήγορα· μη βράσετε ξανά μετά το monter'],
  },
  {
    name: 'Tempering Chocolate',
    nameEl: 'Τέμπερα Σοκολάτας',
    category: 'baking', difficulty: 'advanced', time: 30,
    description: 'Melt chocolate, cool to 27°C to form stable crystals, then rewarm to working temperature (31–32°C for dark). Produces glossy, snappy chocolate that sets at room temperature.',
    descriptionEl: 'Λιώνω σοκολάτα, κρυώνω στους 27°C για σταθερούς κρυστάλλους, κατόπιν ξαναζεσταίνω στη θερμοκρασία εργασίας (31–32°C για μαύρη). Αποτέλεσμα: γυαλιστερή, τραγανή σοκολάτα.',
    tips: ['Use a digital thermometer — temperature windows are only a few degrees wide', 'The seed method (adding 30% finely chopped tempered chocolate) is more reliable', 'Test by spreading a thin layer on parchment — should set in 3–5 min with a sheen and no bloom'],
    tipsEl: ['Χρησιμοποιήστε ψηφιακό θερμόμετρο — τα παράθυρα θερμοκρασίας είναι μόνο λίγοι βαθμοί', 'Μέθοδος σπόρου (προσθήκη 30% ψιλοκομμένης τεμπερέ σοκολάτας) είναι πιο αξιόπιστη', 'Δοκιμάστε σε λαδόκολλα — πρέπει να σετάρει σε 3–5 λεπτά με γυαλάδα χωρίς bloom'],
  },
  {
    name: 'Laminated Dough',
    nameEl: 'Λαμιναρισμένη Ζύμη',
    category: 'baking', difficulty: 'advanced', time: 60,
    description: 'Encase butter inside a yeast dough and fold it through repeated turns to create hundreds of alternating butter-dough layers — the flaky honeycomb interior of croissants and Danish.',
    descriptionEl: 'Περικλείω βούτυρο σε ζύμη με μαγιά και διπλώνω μέσω επαναλαμβανόμενων στροφών για εκατοντάδες εναλλασσόμενα στρώματα — η ξεφλουδισμένη δομή κρουασάν και Δανέζικων.',
    tips: ['Dough and butter must be the same temperature and pliability — cold but bendable', 'Rest the dough in the fridge between turns to prevent the butter from melting or tearing through', 'Any gaps in the butter layer will collapse the lamination during baking'],
    tipsEl: ['Ζύμη και βούτυρο πρέπει να έχουν ίδια θερμοκρασία — κρύα αλλά εύκαμπτα', 'Ξεκουράστε στο ψυγείο μεταξύ στροφών για να μην λιώσει το βούτυρο', 'Κάθε κενό στο στρώμα βουτύρου θα καταστρέψει τη στρωμάτωση κατά το ψήσιμο'],
  },
  {
    name: 'Crème Pâtissière',
    nameEl: 'Κρέμα Ζαχαροπλαστικής',
    category: 'baking', difficulty: 'intermediate', time: 20,
    description: 'A thick, stable pastry cream of milk, egg yolks, sugar, cornstarch, and butter. The base for tarts, éclairs, and mille-feuille. Cooked in a saucepan until thick and glossy.',
    descriptionEl: 'Παχιά, σταθερή κρέμα ζαχαροπλαστικής από γάλα, κρόκους, ζάχαρη, κορνφλάουρ και βούτυρο. Βάση για τάρτες, εκλέρ και μιλφέιγ. Μαγειρεύεται μέχρι να γίνει παχιά και γυαλιστερή.',
    tips: ['Temper the yolks by slowly adding hot milk before returning to the pan', 'Once the starch is cooked, continue for 1–2 minutes to remove any starchy taste', 'Press cling film directly onto the surface before chilling to prevent a skin forming'],
    tipsEl: ['Κάντε temper τους κρόκους προσθέτοντας αργά το ζεστό γάλα για να μην πήξουν', 'Μόλις ψηθεί το άμυλο, συνεχίστε 1–2 λεπτά για να φύγει η αμυλώδης γεύση', 'Σκεπάστε με μεμβράνη κατευθείαν στην επιφάνεια πριν κρυώσει για να μην σχηματιστεί πέτσα'],
  },
  {
    name: 'Choux Pastry',
    nameEl: 'Ζύμη Σου',
    category: 'baking', difficulty: 'intermediate', time: 25,
    description: 'A cooked paste of water, butter, flour, and eggs that leavens entirely by steam — expanding to create hollow éclairs, profiteroles, and gougères in the oven.',
    descriptionEl: 'Ψημένη ζύμη από νερό, βούτυρο, αλεύρι και αβγά που φουσκώνει αποκλειστικά με ατμό — δημιουργεί κοίλα εκλέρ, προφιτερόλ και γκουγκέρ.',
    tips: ['Cook the panade until it pulls cleanly from the pan sides', 'Allow the paste to cool to ~60°C before adding eggs to prevent scrambling', 'Add eggs one at a time; stop when the paste falls off the spatula in a slow ribbon'],
    tipsEl: ['Μαγειρέψτε μέχρι η ζύμη να αποκολλάται καθαρά από τα τοιχώματα', 'Αφήστε να κρυώσει στους ~60°C πριν προσθέσετε τα αβγά για αποφυγή ψησίματος', 'Προσθέτετε αβγά ένα-ένα· σταματήστε όταν η ζύμη πέφτει σε αργή κορδέλα από τη σπάτουλα'],
  },
  {
    name: 'Mise en Place',
    category: 'prep', difficulty: 'beginner', time: 15,
    description: 'Organise and prepare everything before cooking begins — weighed ingredients, prepped vegetables, equipment at hand, timers set. The single most important professional kitchen habit.',
    descriptionEl: 'Οργανώνω και προετοιμάζω τα πάντα πριν ξεκινήσει το μαγείρεμα — ζυγισμένα υλικά, έτοιμα λαχανικά, εξοπλισμός στη θέση του. Η πιο σημαντική συνήθεια επαγγελματικής κουζίνας.',
    tips: ['Read the entire recipe before beginning any prep', 'Work from the longest to the shortest prep task', 'Use small ramekins or bowls for pre-measured dry ingredients'],
    tipsEl: ['Διαβάστε ολόκληρη τη συνταγή πριν ξεκινήσετε οποιαδήποτε προετοιμασία', 'Εργαστείτε από τη μακρύτερη στη συντομότερη εργασία προετοιμασίας', 'Χρησιμοποιήστε μικρά μπολ ή ραμεκίν για προ-ζυγισμένα ξηρά υλικά'],
  },
  {
    name: 'Stock Making',
    nameEl: 'Παρασκευή Ζωμού',
    category: 'prep', difficulty: 'beginner', time: 30,
    description: 'Extract collagen, flavour, and body from bones, vegetables, and aromatics through long simmering in cold water. The foundation of classical sauce-making.',
    descriptionEl: 'Εξάγω κολλαγόνο, γεύση και σώμα από κόκαλα, λαχανικά και αρωματικά μέσω μακρού σιγοβρασμού σε κρύο νερό. Θεμέλιο κλασικής σαλτσοποιίας.',
    tips: ['Start with cold water — it draws impurities to the surface for easy skimming', 'Skim foam thoroughly in the first 20 minutes for a clear stock', 'Never season stock — it is a building block; season the final dish instead'],
    tipsEl: ['Ξεκινήστε με κρύο νερό — τραβά τις ακαθαρσίες στην επιφάνεια για εύκολο ξάφρισμα', 'Ξαφρίστε καλά τα πρώτα 20 λεπτά για διαυγή ζωμό', 'Ποτέ μη αλατίζετε το ζωμό — είναι δομικό στοιχείο· αλατίστε το τελικό πιάτο'],
  },
  {
    name: 'Curing & Brining',
    nameEl: 'Άλμη & Ωρίμανση',
    category: 'prep', difficulty: 'intermediate', time: 20,
    description: 'Wet brine: submerge in salted water (5–10%) to add moisture and season throughout. Dry cure: rub salt (and optionally sugar/spices) directly onto the protein.',
    descriptionEl: 'Υγρή άλμη: εμβυθίζω σε αλατόνερο (5–10%) για υγρασία και αλατισμό σε βάθος. Ξηρή άλμη: τρίβω αλάτι (και προαιρετικά ζάχαρη/μπαχαρικά) απευθείας στην πρωτεΐνη.',
    tips: ['Wet brine at 5–10% salt by weight of water; 2–24 hours depending on size', 'Dry-brining overnight in the fridge also dries the skin — ideal before roasting poultry', 'Rinse and pat dry after brining before applying heat'],
    tipsEl: ['Υγρή άλμη σε 5–10% αλάτι κατά βάρος νερού· 2–24 ώρες ανάλογα το μέγεθος', 'Ξηρή άλμη τη νύχτα στο ψυγείο ξεραίνει και την πέτσα — ιδανικό πριν ψήσιμο πουλερικών', 'Ξεπλύντε και στεγνώστε καλά μετά την άλμη πριν εφαρμόσετε θερμότητα'],
  },
]

const ALL_CATEGORIES: TechCategory[] = ['knifeSkills', 'heatMethods', 'sauces', 'baking', 'prep']
const ALL_DIFFICULTIES: Difficulty[]  = ['beginner', 'intermediate', 'advanced']

const DIFF_COLORS: Record<Difficulty, string> = {
  beginner:     'text-emerald-400 bg-emerald-400/10 border-emerald-400/20',
  intermediate: 'text-amber-400 bg-amber-400/10 border-amber-400/20',
  advanced:     'text-red-400 bg-red-400/10 border-red-400/20',
}

const CAT_COLORS: Record<TechCategory, string> = {
  knifeSkills: 'text-sky-400 bg-sky-400/10',
  heatMethods: 'text-orange-400 bg-orange-400/10',
  sauces:      'text-violet-400 bg-violet-400/10',
  baking:      'text-pink-400 bg-pink-400/10',
  prep:        'text-teal-400 bg-teal-400/10',
}

function TechCard({ tech, isEl, tFn }: { tech: Technique; isEl: boolean; tFn: (k: string) => string }) {
  const [open, setOpen] = useState(false)
  const name = isEl && tech.nameEl ? tech.nameEl : tech.name
  const desc = isEl ? tech.descriptionEl : tech.description
  const tips = isEl ? tech.tipsEl : tech.tips

  return (
    <GlassCard className="!p-0 overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left px-4 py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className={cn('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium border', DIFF_COLORS[tech.difficulty])}>
                {tFn(`techniques.${tech.difficulty}`)}
              </span>
              <span className={cn('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium', CAT_COLORS[tech.category])}>
                {tFn(`techniques.${tech.category}`)}
              </span>
            </div>
            <p className="font-semibold text-white">{name}</p>
            <div className="flex items-center gap-1 mt-1 text-xs text-white/35">
              <Clock className="h-3 w-3" />
              <span>~{tech.time} {tFn('techniques.mins')}</span>
            </div>
          </div>
          {open ? <ChevronUp className="h-4 w-4 text-white/30 shrink-0 mt-1" />
                : <ChevronDown className="h-4 w-4 text-white/30 shrink-0 mt-1" />}
        </div>
        <p className={cn('text-sm text-white/60 leading-relaxed mt-2', !open && 'line-clamp-2')}>{desc}</p>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-white/6 pt-3">
          <p className="text-xs text-white/35 uppercase tracking-wider mb-2">{tFn('techniques.tips')}</p>
          <ul className="space-y-1.5">
            {tips.map((tip, i) => (
              <li key={i} className="flex gap-2 text-sm text-white/65">
                <span className="text-brand-orange mt-0.5 shrink-0">›</span>
                <span>{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </GlassCard>
  )
}

export default function TechniqueLibrary() {
  const { t, i18n } = useTranslation()
  const isEl = i18n.language.startsWith('el')

  const [search,     setSearch]     = useState('')
  const [category,   setCategory]   = useState<TechCategory | 'all'>('all')
  const [difficulty, setDifficulty] = useState<Difficulty | 'all'>('all')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return TECHNIQUES.filter((tech) => {
      const matchCat  = category   === 'all' || tech.category   === category
      const matchDiff = difficulty === 'all' || tech.difficulty === difficulty
      const name = isEl && tech.nameEl ? tech.nameEl : tech.name
      const desc = isEl ? tech.descriptionEl : tech.description
      const matchQ = !q || name.toLowerCase().includes(q) || desc.toLowerCase().includes(q)
      return matchCat && matchDiff && matchQ
    })
  }, [search, category, difficulty, isEl])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('techniques.title')}</h1>
        <p className="text-sm text-white/40 mt-1">{t('techniques.subtitle')}</p>
      </div>

      <div className="space-y-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
          <input type="text" placeholder={t('techniques.search')} value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:ring-1 focus:ring-brand-orange/50 w-full" />
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCategory('all')}
            className={cn('px-3 py-1 rounded-full text-xs font-medium transition',
              category === 'all' ? 'bg-brand-orange text-white' : 'glass text-white/50 hover:text-white/80')}>
            {t('techniques.all')}
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button key={cat} type="button" onClick={() => setCategory(cat)}
              className={cn('px-3 py-1 rounded-full text-xs font-medium transition',
                category === cat ? 'bg-brand-orange text-white' : 'glass text-white/50 hover:text-white/80')}>
              {t(`techniques.${cat}`)}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setDifficulty('all')}
            className={cn('px-3 py-1 rounded-full text-xs font-medium transition border border-transparent',
              difficulty === 'all' ? 'bg-white/15 text-white' : 'text-white/35 hover:text-white/60')}>
            {t('techniques.all')}
          </button>
          {ALL_DIFFICULTIES.map((d) => (
            <button key={d} type="button" onClick={() => setDifficulty(d)}
              className={cn('px-3 py-1 rounded-full text-xs font-medium transition border',
                difficulty === d ? DIFF_COLORS[d] : 'border-transparent text-white/35 hover:text-white/60')}>
              {t(`techniques.${d}`)}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-white/30 py-16">{t('techniques.noResults')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((tech) => (
            <TechCard key={tech.name} tech={tech} isEl={isEl} tFn={t} />
          ))}
        </div>
      )}
    </div>
  )
}
