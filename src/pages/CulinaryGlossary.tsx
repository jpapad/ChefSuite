import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { cn } from '../lib/cn'

type GlossaryCategory = 'techniques' | 'equipment' | 'french' | 'italian' | 'baking' | 'sauces'

interface GlossaryTerm {
  term: string
  category: GlossaryCategory
  definition: string
  definitionEl: string
  el?: string
}

const TERMS: GlossaryTerm[] = [
  { term: 'Al dente', category: 'italian', el: 'Αλ ντέντε',
    definition: 'Pasta or rice cooked until just firm to the bite — from Italian "to the tooth".',
    definitionEl: 'Ζυμαρικά ή ρύζι μαγειρεμένα ώστε να παραμένουν ελαφρώς σκληρά στο δάγκωμα — από τα ιταλικά "στο δόντι".' },
  { term: 'Baste', category: 'techniques', el: 'Αλοιφή',
    definition: 'Spoon or brush pan drippings, butter, or marinade over food during cooking to add moisture and flavour.',
    definitionEl: 'Περιχύνω ή αλείφω φαγητό κατά το μαγείρεμα με τα υγρά του, βούτυρο ή μαρινάδα για να διατηρηθεί υγρασία και γεύση.' },
  { term: 'Béchamel', category: 'sauces', el: 'Μπεσαμέλ',
    definition: 'White sauce made from milk and a white roux — one of the five French mother sauces; base for Mornay sauce.',
    definitionEl: 'Λευκή σάλτσα από γάλα και λευκό ρου — μία από τις πέντε γαλλικές μητρικές σάλτσες· βάση για τη σάλτσα Mornay.' },
  { term: 'Beurre blanc', category: 'sauces', el: 'Μπέρ μπλαν',
    definition: 'Classic French butter sauce: reduce white wine and vinegar with shallots, then mount with cold butter.',
    definitionEl: 'Κλασική γαλλική σάλτσα βουτύρου: μειώνω λευκό κρασί και ξύδι με κρεμμυδάκι, κατόπιν ανακατεύω με κρύο βούτυρο.' },
  { term: 'Beurre manié', category: 'sauces', el: 'Μπέρ μανιέ',
    definition: 'Equal parts soft butter and flour kneaded together — whisked into sauces at the end to thicken without lumps.',
    definitionEl: 'Ίσα μέρη μαλακού βουτύρου και αλευριού ζυμωμένα μαζί — προστίθεται σε σάλτσες στο τέλος για πάχυνση χωρίς σβώλους.' },
  { term: 'Blanch', category: 'techniques', el: 'Μπλανσάρισμα',
    definition: 'Briefly boil food then plunge into ice water to stop cooking — preserves colour, texture, and nutrients.',
    definitionEl: 'Βράζω σύντομα και βυθίζω σε παγωμένο νερό για να σταματήσω το μαγείρεμα — διατηρεί χρώμα, σύσταση και θρεπτικά.' },
  { term: 'Bouquet garni', category: 'french', el: 'Μπουκέ γκαρνί',
    definition: 'A bundle of fresh herbs (parsley, thyme, bay leaf) tied together and added to flavour stocks and braises.',
    definitionEl: 'Δέσμη φρέσκων μυρωδικών (μαϊντανός, θυμάρι, δάφνη) δεμένη μαζί για γεύσιση ζωμών και κρεατόσουπων.' },
  { term: 'Braise', category: 'techniques', el: 'Μπρεζάρισμα',
    definition: 'Brown food first, then slow-cook covered in a small amount of liquid — best for tough cuts; converts collagen to gelatin.',
    definitionEl: 'Ροδίζω πρώτα, κατόπιν σιγομαγειρεύω σκεπαστό σε λίγο υγρό — ιδανικό για σκληρά κρέατα· μετατρέπει κολλαγόνο σε ζελατίνη.' },
  { term: 'Brine', category: 'techniques', el: 'Άλμη',
    definition: 'Soak food in salted water (often with sugar and spices) to add moisture and season throughout before cooking.',
    definitionEl: 'Εμβυθίζω φαγητό σε αλατόνερο (συχνά με ζάχαρη και μπαχαρικά) για υγρασία και αλατισμό σε όλο το βάθος.' },
  { term: 'Brunoise', category: 'french', el: 'Μπρινουάζ',
    definition: 'Vegetables cut into tiny 1–3 mm cubes — the finest standard knife cut. Start from julienne strips.',
    definitionEl: 'Λαχανικά κομμένα σε μικρούς κύβους 1–3 mm — η λεπτότερη τυπική κοπή μαχαιριού. Ξεκινά από ζυλιέν ράβδους.' },
  { term: 'Caramelise', category: 'techniques', el: 'Καραμελοποίηση',
    definition: 'Cook sugar until it melts and turns golden-brown (~160°C), developing complex flavour compounds.',
    definitionEl: 'Μαγειρεύω ζάχαρη μέχρι να λιώσει και να γίνει χρυσοκάστανη (~160°C), αναπτύσσοντας σύνθετες γεύσεις.' },
  { term: 'Chiffonade', category: 'techniques', el: 'Σιφονάδ',
    definition: 'Stack leafy herbs or greens, roll tightly into a cylinder, then slice crosswise into thin ribbons.',
    definitionEl: 'Στοιβάζω φυλλώδη μυρωδικά, τα τυλίγω σφιχτά σε κύλινδρο και κόβω κάθετα σε λεπτές κορδέλες.' },
  { term: 'Clarify', category: 'techniques', el: 'Διαύγαση',
    definition: 'Remove impurities from butter (making ghee) or stock to produce a clear, clean liquid.',
    definitionEl: 'Αφαιρώ ακαθαρσίες από βούτυρο (κάνοντας γκι) ή ζωμό για διαυγές, καθαρό υγρό.' },
  { term: 'Confit', category: 'french', el: 'Κονφί',
    definition: 'Cook food slowly fully submerged in fat at low temperature (80–90°C) — from the French word "to preserve".',
    definitionEl: 'Μαγειρεύω αργά βυθισμένο σε λίπος στους 80–90°C — από τη γαλλική λέξη "να διατηρήσω".' },
  { term: 'Consommé', category: 'french', el: 'Κονσομέ',
    definition: 'A perfectly clear, richly flavoured stock clarified using a raft of ground meat, mirepoix, and egg whites.',
    definitionEl: 'Απόλυτα διαυγής, πλούσιος ζωμός αποδιαυγασμένος με raft από αλεσμένο κρέας, μιρεπουά και ασπράδια.' },
  { term: 'Coulis', category: 'sauces', el: 'Κουλί',
    definition: 'A smooth, thick sauce or purée made from fruit or vegetables, passed through a fine-mesh sieve.',
    definitionEl: 'Λεία, πηχτή σάλτσα ή πουρές από φρούτα ή λαχανικά, περασμένος από λεπτό σήτα.' },
  { term: 'Deglaze', category: 'techniques', el: 'Ντεγκλαζάρω',
    definition: 'Add liquid to a hot pan to dissolve caramelised bits (fond) left after searing — forms the base of a pan sauce.',
    definitionEl: 'Προσθέτω υγρό σε καυτό τηγάνι για να διαλύσω τα καραμελωμένα κατακάθια (fond) — βάση σάλτσας τηγανιού.' },
  { term: 'Dice', category: 'techniques', el: 'Κόβω σε κύβους',
    definition: 'Cut food into uniform cubes — small (6 mm), medium (12 mm), or large (20 mm).',
    definitionEl: 'Κόβω φαγητό σε ομοιόμορφους κύβους — μικρούς (6 mm), μεσαίους (12 mm) ή μεγάλους (20 mm).' },
  { term: 'Emulsify', category: 'techniques', el: 'Γαλακτωματοποίηση',
    definition: 'Force two immiscible liquids (oil and water) to blend using an emulsifier such as egg yolk or mustard.',
    definitionEl: 'Αναγκάζω δύο μη αναμίξιμα υγρά (λάδι και νερό) να αναμειχθούν χρησιμοποιώντας γαλακτωματοποιητή όπως κρόκο ή μουστάρδα.' },
  { term: 'En papillote', category: 'french', el: 'Ε παπιγιότ',
    definition: 'Bake food sealed inside a parchment or foil parcel — the trapped steam gently cooks the food.',
    definitionEl: 'Ψήνω φαγητό σφραγισμένο σε λαδόκολλα ή αλουμινόχαρτο — ο εγκλωβισμένος ατμός το μαγειρεύει απαλά.' },
  { term: 'Espagnole', category: 'sauces', el: 'Εσπανιόλ',
    definition: 'A rich brown sauce made from brown stock and a dark roux — one of the five French mother sauces.',
    definitionEl: 'Πλούσια καφέ σάλτσα από καφέ ζωμό και σκούρο ρου — μία από τις πέντε γαλλικές μητρικές σάλτσες.' },
  { term: 'Flambé', category: 'french', el: 'Φλαμπέ',
    definition: 'Ignite alcohol poured into a hot pan to burn off harshness and add aromatic complexity.',
    definitionEl: 'Ανάβω οινόπνευμα σε καυτό τηγάνι για να καεί η τραχύτητα και να προστεθεί αρωματική πολυπλοκότητα.' },
  { term: 'Fold', category: 'techniques', el: 'Διπλώνω',
    definition: 'Gently combine a light, airy mixture into a heavier one with a rubber spatula — preserves volume and texture.',
    definitionEl: 'Ανακατεύω απαλά ένα ελαφρύ αέρινο μείγμα σε ένα βαρύτερο με σπάτουλα — διατηρεί τον όγκο και τη σύσταση.' },
  { term: 'Fond', category: 'french', el: 'Φοντ',
    definition: 'Caramelised, flavour-packed brown bits stuck to the bottom of a pan after searing meat.',
    definitionEl: 'Καραμελωμένα κατακάθια με έντονη γεύση στον πάτο του τηγανιού μετά το ψήσιμο κρέατος.' },
  { term: 'Glaze', category: 'techniques', el: 'Γκλαζάρω',
    definition: 'Coat food with a shiny reduced sauce or syrup; or cook vegetables in butter and stock until coated in a glossy film.',
    definitionEl: 'Επικαλύπτω με γυαλιστερή μειωμένη σάλτσα ή σιρόπι· ή μαγειρεύω λαχανικά σε βούτυρο/ζωμό μέχρι να γυαλίσουν.' },
  { term: 'Gratinate', category: 'techniques', el: 'Γκρατινάρω',
    definition: 'Brown the top of a dish under a grill or salamander to create a golden, crispy crust.',
    definitionEl: 'Ροδίζω την επιφάνεια ενός πιάτου κάτω από γκριλ ή σαλαμάντρα για χρυσαφένια τραγανή κρούστα.' },
  { term: 'Hollandaise', category: 'sauces', el: 'Ολανδέζ',
    definition: 'A classic emulsion sauce of egg yolks and clarified butter with lemon — one of the five French mother sauces.',
    definitionEl: 'Κλασική σάλτσα γαλακτωματοποίησης από κρόκους και αποδιαυγασμένο βούτυρο με λεμόνι — μία από τις πέντε μητρικές σάλτσες.' },
  { term: 'Julienne', category: 'techniques', el: 'Ζυλιέν',
    definition: 'Cut vegetables into thin, uniform matchstick strips (3 mm × 3 mm × 6 cm) — used for garnishes and stir-fries.',
    definitionEl: 'Κόβω λαχανικά σε λεπτές ομοιόμορφες ράβδους σαν σπίρτα (3 mm × 3 mm × 6 cm) — γκαρνιτούρες και stir-fries.' },
  { term: 'Liaison', category: 'sauces', el: 'Λιεζόν',
    definition: 'A mixture of egg yolks and cream whisked into a hot sauce to thicken and enrich it — never boil after adding.',
    definitionEl: 'Μείγμα κρόκων και κρέμας που ανακατεύεται σε ζεστή σάλτσα για πάχυνση και πλούτο — δεν βράζω ποτέ μετά.' },
  { term: 'Macerate', category: 'techniques', el: 'Μαρινάρισμα φρούτων',
    definition: 'Soak fruit in sugar, alcohol, or flavoured liquid to soften it and allow flavours to blend.',
    definitionEl: 'Εμβυθίζω φρούτα σε ζάχαρη, αλκοόλ ή αρωματικό υγρό για να μαλακώσουν και να αναμειχθούν οι γεύσεις.' },
  { term: 'Maillard Reaction', category: 'techniques', el: 'Αντίδραση Maillard',
    definition: 'The chemical reaction between amino acids and sugars at ~140°C that creates the complex brown crust on seared, roasted, and baked foods.',
    definitionEl: 'Χημική αντίδραση αμινοξέων και σακχάρων στους ~140°C που δημιουργεί τη σύνθετη καφετί κρούστα σε ψητά και σοταριστά τρόφιμα.' },
  { term: 'Marinate', category: 'techniques', el: 'Μαρινάρισμα',
    definition: 'Soak food in a flavoured liquid (acid + oil + aromatics) before cooking to tenderise and add flavour.',
    definitionEl: 'Εμβυθίζω φαγητό σε αρωματικό υγρό (οξύ + λάδι + αρωματικά) πριν το μαγείρεμα για μαλάκωμα και γεύση.' },
  { term: 'Meunière', category: 'french', el: 'Μενιέρ',
    definition: 'Fish dusted in flour, pan-fried in butter, then finished with lemon juice and parsley.',
    definitionEl: 'Ψάρι αλευρωμένο, τηγανιτό σε βούτυρο, με χυμό λεμονιού και μαϊντανό.' },
  { term: 'Mirepoix', category: 'french', el: 'Μιρεπουά',
    definition: 'Classic aromatic base: 2 parts onion, 1 part celery, 1 part carrot — foundation of stocks, soups, and braises.',
    definitionEl: 'Κλασική αρωματική βάση: 2 μέρη κρεμμύδι, 1 σέλινο, 1 καρότο — θεμέλιο ζωμών, σούπών και σιγομαγειρεμένων.' },
  { term: 'Mise en place', category: 'french', el: 'Μίζ αν πλας',
    definition: 'French for "everything in its place" — preparing and organising all ingredients and equipment before cooking begins.',
    definitionEl: 'Γαλλικά για "το καθετί στη θέση του" — προετοιμασία και οργάνωση όλων των υλικών πριν ξεκινήσει το μαγείρεμα.' },
  { term: 'Nappe', category: 'sauces', el: 'Ναπέ',
    definition: 'When a sauce is thick enough to coat the back of a spoon and a line drawn through it holds its shape cleanly.',
    definitionEl: 'Όταν μια σάλτσα επικαλύπτει την πλάτη κουταλιού και μια γραμμή που τραβιέται στη μέση παραμένει καθαρή.' },
  { term: 'Poach', category: 'techniques', el: 'Ποσάρισμα',
    definition: 'Cook food gently submerged in liquid held just below simmering (70–80°C) — ideal for eggs, fish, and fruit.',
    definitionEl: 'Μαγειρεύω απαλά βυθισμένο σε υγρό στους 70–80°C (κάτω από βρασμό) — ιδανικό για αβγά, ψάρι και φρούτα.' },
  { term: 'Reduce', category: 'techniques', el: 'Μειώνω (ρεντουίρω)',
    definition: 'Simmer a liquid until its volume decreases through evaporation — concentrates flavour and thickens the sauce.',
    definitionEl: 'Σιγοβράζω υγρό μέχρι να μειωθεί ο όγκος του — συγκεντρώνει τη γεύση και πυκνώνει τη σάλτσα.' },
  { term: 'Render', category: 'techniques', el: 'Λιώσιμο λίπους',
    definition: 'Slowly heat fatty meat (bacon, duck skin) so the fat melts out — results in crispy, flavourful texture.',
    definitionEl: 'Ζεσταίνω αργά λιπαρό κρέας (μπέικον, πέτσα πάπιας) ώστε να λιώσει το λίπος — τραγανή, γευστική σύσταση.' },
  { term: 'Rest', category: 'techniques', el: 'Ξεκούραση κρέατος',
    definition: 'Allow cooked meat to sit off heat before slicing — lets juices redistribute for a moister, more even result.',
    definitionEl: 'Αφήνω το μαγειρεμένο κρέας να ηρεμήσει πριν κόψω — οι χυμοί αναδιανέμονται για πιο ζουμερό αποτέλεσμα.' },
  { term: 'Roux', category: 'sauces', el: 'Ρου',
    definition: 'Equal parts butter and flour cooked together — the thickening base for béchamel, velouté, and other classical sauces.',
    definitionEl: 'Ίσα μέρη βουτύρου και αλευριού μαγειρεμένα μαζί — βάση πάχυνσης για μπεσαμέλ, βελουτέ και κλασικές σάλτσες.' },
  { term: "Sachet d'épices", category: 'french', el: "Σατσέ ντ'επίς",
    definition: 'A small muslin bag of aromatics (peppercorns, bay, thyme, parsley stems) added to stocks and braises.',
    definitionEl: 'Μικρό πανί με αρωματικά (πιπέρι, δάφνη, θυμάρι, κοτσάνια μαϊντανού) που προστίθεται σε ζωμούς και σιγομαγειρεμένα.' },
  { term: 'Sauté', category: 'french', el: 'Σοτάρω',
    definition: 'Cook food quickly in a small amount of fat over high heat with movement — from the French "to jump".',
    definitionEl: 'Μαγειρεύω γρήγορα σε λίγο λίπος σε δυνατή φωτιά με κίνηση — από τα γαλλικά "να πηδήξω".' },
  { term: 'Score', category: 'techniques', el: 'Χαράσσω',
    definition: 'Make shallow cuts in the surface of food — helps marinades penetrate and fat render from fish skin or duck breast.',
    definitionEl: 'Κάνω ρηχές εγκοπές στην επιφάνεια — βοηθά τις μαρινάδες να διεισδύσουν και το λίπος να λιώσει από πέτσα ψαριού ή στήθος πάπιας.' },
  { term: 'Sear', category: 'techniques', el: 'Καψαλίζω',
    definition: 'Cook protein at very high dry heat to develop a brown Maillard crust — for flavour, not for "sealing in juices".',
    definitionEl: 'Ψήνω σε πολύ δυνατή ξηρή φωτιά για καφετί κρούστα Maillard — για γεύση, όχι για "σφράγισμα χυμών".' },
  { term: 'Skim', category: 'techniques', el: 'Ξαφρίζω',
    definition: 'Remove foam, fat, or impurities from the surface of a simmering stock or sauce for clarity and clean flavour.',
    definitionEl: 'Αφαιρώ αφρό, λίπος ή ακαθαρσίες από την επιφάνεια σιγοβράζοντος ζωμού για διαύγεια και καθαρή γεύση.' },
  { term: 'Sweat', category: 'techniques', el: 'Ιδρώνω λαχανικά',
    definition: 'Cook vegetables gently in fat over low heat until soft and translucent, without browning — mellows and sweetens flavour.',
    definitionEl: 'Μαγειρεύω λαχανικά απαλά σε λίπος σε χαμηλή φωτιά μέχρι να μαλακώσουν χωρίς να ροδίσουν — μαλακώνει και γλυκαίνει τη γεύση.' },
  { term: 'Temper', category: 'techniques', el: 'Τέμπερα',
    definition: 'Gradually raise the temperature of a delicate ingredient (eggs, chocolate) before combining with a hot mixture to prevent curdling.',
    definitionEl: 'Ανεβάζω σταδιακά τη θερμοκρασία ενός ευαίσθητου υλικού (αβγά, σοκολάτα) πριν το συνδυάσω με ζεστό μείγμα για να αποφύγω κοπή.' },
  { term: 'Tomato (mother)', category: 'sauces', el: 'Σάλτσα τομάτας',
    definition: 'Tomato-based mother sauce — one of the five classical French sauces; base for countless derivatives.',
    definitionEl: 'Μητρική σάλτσα τομάτας — μία από τις πέντε κλασικές γαλλικές σάλτσες· βάση για αμέτρητα παράγωγα.' },
  { term: 'Tourné', category: 'french', el: 'Τουρνέ',
    definition: 'A 7-sided, football-shaped vegetable cut made with a curved tourné knife — a classic French knife-skill test.',
    definitionEl: 'Κλασικό γαλλικό σχήμα 7 πλευρών σαν αμερικανικό ποδόσφαιρο, σκαλισμένο με τουρνέ μαχαίρι — κλασική δοκιμασία μαχαιρικής.' },
  { term: 'Truss', category: 'techniques', el: 'Δένω πουλερικά',
    definition: 'Tie poultry or a roast with kitchen twine to hold its shape and promote even cooking throughout.',
    definitionEl: 'Δένω πουλερικά ή ψητό κρέας με σπάγκο κουζίνας για να διατηρήσω το σχήμα τους και να εξασφαλίσω ομοιόμορφο ψήσιμο.' },
  { term: 'Velouté', category: 'sauces', el: 'Βελουτέ',
    definition: 'A white stock (chicken, veal, or fish) thickened with a blonde roux — one of the five French mother sauces.',
    definitionEl: 'Λευκός ζωμός (κοτόπουλο, μοσχάρι ή ψάρι) παχυμένος με ξανθό ρου — μία από τις πέντε γαλλικές μητρικές σάλτσες.' },
  { term: 'Bain-marie', category: 'equipment', el: 'Μπεν-μαρί',
    definition: 'A water bath used to gently heat or keep food warm — essential for custards, chocolate melting, and delicate sauces.',
    definitionEl: 'Υδατόλουτρο για απαλή θέρμανση ή διατήρηση ζεστασιάς — απαραίτητο για κρέμες, λιώσιμο σοκολάτας και ευαίσθητες σάλτσες.' },
  { term: 'Mandoline', category: 'equipment', el: 'Μαντολίνο',
    definition: 'A flat slicer with an adjustable blade — produces very thin, uniform slices far faster than a knife.',
    definitionEl: 'Επίπεδος τεμαχιστής με ρυθμιζόμενη λεπίδα — παράγει πολύ λεπτές, ομοιόμορφες φέτες πολύ πιο γρήγορα από μαχαίρι.' },
  { term: 'Salamander', category: 'equipment', el: 'Σαλαμάντρα',
    definition: 'An overhead grill/broiler used to quickly brown or gratinate the top of dishes without cooking them through.',
    definitionEl: 'Γκριλ από πάνω που χρησιμοποιείται για γρήγορο γκρατινάρισμα ή ροδίσιμο επιφάνειας πιάτων.' },
  { term: 'Tamis / Drum sieve', category: 'equipment', el: 'Κόσκινο τύμπανο',
    definition: 'A flat, fine-mesh drum sieve used to pass purées and sauces for an ultra-smooth texture.',
    definitionEl: 'Επίπεδη, λεπτόκοκκη σήτα για πέρασμα πουρέ και σάλτσων ώστε να επιτευχθεί υπερλεπτή σύσταση.' },
  { term: 'Spider strainer', category: 'equipment', el: 'Αραχνοειδές κόσκινο',
    definition: 'A wide, shallow wire-mesh scoop used to lift and drain fried or blanched foods quickly.',
    definitionEl: 'Φαρδύ, ρηχό σύρμα για γρήγορη ανάσυρση και στράγγισμα τηγανητών ή μπλανσαρισμένων τροφών.' },
  { term: 'Chinois', category: 'equipment', el: 'Σινουά',
    definition: 'A conical fine-mesh strainer used to strain stocks and sauces to remove all solids.',
    definitionEl: 'Κωνικό λεπτόκοκκο σήτα για στράγγισμα ζωμών και σάλτσων από κάθε στερεό.' },
  { term: 'Larding needle', category: 'equipment', el: 'Βελόνα λαρδαρίσματος',
    definition: 'A hollow needle used to thread strips of fat into lean cuts of meat to add moisture and flavour during roasting.',
    definitionEl: 'Κοίλη βελόνα για να περνώ λουρίδες λίπους σε άπαχα κρέατα για υγρασία και γεύση κατά το ψήσιμο.' },
  { term: 'Pâte à choux', category: 'baking', el: 'Πατ α σου',
    definition: 'A light cooked paste of water, butter, flour, and eggs — leavened entirely by steam to make éclairs and profiteroles.',
    definitionEl: 'Ελαφρύ, ψημένο μείγμα από νερό, βούτυρο, αλεύρι και αβγά — φουσκώνει αποκλειστικά με ατμό για εκλέρ και προφιτερόλ.' },
  { term: 'Lamination', category: 'baking', el: 'Λαμινάρισμα',
    definition: 'Folding butter into yeast dough through repeated turns to create hundreds of flaky, alternating layers — croissants, Danish pastries.',
    definitionEl: 'Δίπλωμα βουτύρου σε ζύμη με μαγιά μέσω επαναλαμβανόμενων στροφών για εκατοντάδες εναλλασσόμενα στρώματα — κρουασάν, Δανέζικα.' },
  { term: 'Crème pâtissière', category: 'baking', el: 'Κρέμα ζαχαροπλαστικής',
    definition: 'A thick, rich pastry cream of milk, egg yolks, sugar, and starch — the base for tarts, éclairs, and mille-feuille.',
    definitionEl: 'Παχιά, πλούσια κρέμα ζαχαροπλαστικής από γάλα, κρόκους, ζάχαρη και άμυλο — βάση για τάρτες, εκλέρ και μιλφέιγ.' },
  { term: 'Blind baking', category: 'baking', el: 'Τυφλό ψήσιμο',
    definition: 'Bake a pastry shell without its filling — weighted with beans or rice to prevent shrinkage and bubbles.',
    definitionEl: 'Ψήνω ζύμη χωρίς γέμιση — σταθεροποιώ με όσπρια ή ρύζι για να αποτρέψω συρρίκνωση και φουσκάλες.' },
  { term: 'Proofing', category: 'baking', el: 'Φούσκωμα ζύμης',
    definition: 'The final rise of shaped dough before baking — allows yeast to produce CO₂ that creates the open crumb structure.',
    definitionEl: 'Τελευταίο φούσκωμα διαμορφωμένης ζύμης πριν το ψήσιμο — η μαγιά παράγει CO₂ που δημιουργεί την ανοιχτή δομή της ψίχας.' },
]

const ALL_CATEGORIES: GlossaryCategory[] = ['techniques', 'french', 'sauces', 'italian', 'baking', 'equipment']

export default function CulinaryGlossary() {
  const { t, i18n } = useTranslation()
  const isEl = i18n.language.startsWith('el')

  const [search,   setSearch]   = useState('')
  const [category, setCategory] = useState<GlossaryCategory | 'all'>('all')

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return TERMS.filter((item) => {
      const matchCat = category === 'all' || item.category === category
      const def = isEl ? item.definitionEl : item.definition
      const matchQ = !q
        || item.term.toLowerCase().includes(q)
        || def.toLowerCase().includes(q)
        || (item.el?.toLowerCase().includes(q) ?? false)
      return matchCat && matchQ
    })
  }, [search, category, isEl])

  const CATEGORY_COLORS: Record<GlossaryCategory, string> = {
    techniques: 'text-sky-400 bg-sky-400/10',
    french:     'text-violet-400 bg-violet-400/10',
    sauces:     'text-amber-400 bg-amber-400/10',
    italian:    'text-emerald-400 bg-emerald-400/10',
    baking:     'text-pink-400 bg-pink-400/10',
    equipment:  'text-slate-400 bg-slate-400/10',
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('glossary.title')}</h1>
        <p className="text-sm text-white/40 mt-1">{t('glossary.subtitle')}</p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
          <input type="text" placeholder={t('glossary.search')} value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="glass rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:ring-1 focus:ring-brand-orange/50 w-full" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCategory('all')}
            className={cn('px-3 py-1 rounded-full text-xs font-medium transition',
              category === 'all' ? 'bg-brand-orange text-white' : 'glass text-white/50 hover:text-white/80')}>
            {t('glossary.all')} ({TERMS.length})
          </button>
          {ALL_CATEGORIES.map((cat) => (
            <button key={cat} type="button" onClick={() => setCategory(cat)}
              className={cn('px-3 py-1 rounded-full text-xs font-medium transition',
                category === cat ? 'bg-brand-orange text-white' : 'glass text-white/50 hover:text-white/80')}>
              {t(`glossary.${cat}`)} ({TERMS.filter((item) => item.category === cat).length})
            </button>
          ))}
        </div>
      </div>

      {search && (
        <p className="text-xs text-white/30">
          {filtered.length} {filtered.length === 1 ? (isEl ? 'όρος' : 'term') : (isEl ? 'όροι' : 'terms')} {isEl ? 'βρέθηκαν' : 'found'}
        </p>
      )}

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-white/30 py-16">{t('glossary.noResults')}</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <GlassCard key={item.term} className="!p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold text-white">{item.term}</p>
                  {item.el && <p className="text-xs text-white/40 mt-0.5">{item.el}</p>}
                </div>
                <span className={cn('text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium shrink-0', CATEGORY_COLORS[item.category])}>
                  {t(`glossary.${item.category}`)}
                </span>
              </div>
              <p className="text-sm text-white/65 leading-relaxed">
                {isEl ? item.definitionEl : item.definition}
              </p>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  )
}
