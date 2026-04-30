import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, BookOpen } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { cn } from '../lib/cn'
import i18n from '../i18n'

type Category = 'spices' | 'herbs' | 'cheese' | 'oils'

interface IngredientEntry {
  name: string
  nameEl: string
  nameBg: string
  category: Category
  origin?: string
  flavour: string
  flavourEl: string
  flavourBg: string
  uses: string
  usesEl: string
  usesBg: string
  tip?: string
  tipEl?: string
  tipBg?: string
}

const ENTRIES: IngredientEntry[] = [
  // ── SPICES ───────────────────────────────────────────────────────────────
  {
    name: 'Black Pepper', nameEl: 'Μαύρο Πιπέρι', nameBg: 'Черен Пипер',
    category: 'spices', origin: 'India',
    flavour: 'Sharp, pungent, mildly hot', flavourEl: 'Αιχμηρό, καυτερό, ελαφρώς θερμό', flavourBg: 'Остър, пикантен, леко лют',
    uses: 'Universal seasoning; finishing steaks, pasta, sauces', usesEl: 'Καθολικό μπαχαρικό· φινίρισμα σε μπριζόλες, ζυμαρικά, σάλτσες', usesBg: 'Универсална подправка; довършване на пържоли, паста, сосове',
    tip: 'Grind fresh for maximum aroma; loses potency quickly when pre-ground.', tipEl: 'Αλέστε φρέσκο για μέγιστο άρωμα· χάνει ισχύ όταν είναι προαλεσμένο.', tipBg: 'Смилайте пресен за максимален аромат; губи сила при предварително смилане.',
  },
  {
    name: 'Cumin', nameEl: 'Κύμινο', nameBg: 'Кимион',
    category: 'spices', origin: 'Middle East',
    flavour: 'Earthy, warm, slightly bitter', flavourEl: 'Γήινο, ζεστό, ελαφρώς πικρό', flavourBg: 'Землист, топъл, леко горчив',
    uses: 'Tagines, curries, spice rubs, hummus', usesEl: 'Ταζίν, κάρι, τρίμματα μπαχαρικών, χούμους', usesBg: 'Тагин, къри, маринати, хумус',
    tip: 'Toast whole seeds in a dry pan before grinding for deeper flavour.', tipEl: 'Καβουρδίστε ολόκληρους σπόρους σε στεγνό τηγάνι πριν αλέσετε.', tipBg: 'Запечете целите семена на сух тиган преди смилане за по-богат вкус.',
  },
  {
    name: 'Smoked Paprika', nameEl: 'Καπνιστή Πάπρικα', nameBg: 'Пушена Паприка',
    category: 'spices', origin: 'Spain',
    flavour: 'Smoky, sweet, slightly earthy', flavourEl: 'Καπνιστό, γλυκό, ελαφρώς γήινο', flavourBg: 'Пушено, сладко, леко землисто',
    uses: 'Chorizo, patatas bravas, rice, marinades', usesEl: 'Τσορίθο, πατάτες, ρύζι, μαρινάδες', usesBg: 'Чоризо, пататас бравас, ориз, маринати',
    tip: 'Adds colour and depth to dishes without heat; store away from light.', tipEl: 'Δίνει χρώμα και βάθος χωρίς καυτερή γεύση· φυλάσσεται μακριά από φως.', tipBg: 'Добавя цвят и дълбочина без лютивина; съхранявайте далеч от светлина.',
  },
  {
    name: 'Cinnamon', nameEl: 'Κανέλα', nameBg: 'Канела',
    category: 'spices', origin: 'Sri Lanka',
    flavour: 'Sweet, warm, woody', flavourEl: 'Γλυκό, ζεστό, ξυλώδες', flavourBg: 'Сладка, топла, дървесна',
    uses: 'Pastries, stews, tagines, mulled wine', usesEl: 'Αρτοσκευάσματα, στιφάδο, ταζίν, κρασί με μπαχαρικά', usesBg: 'Сладкиши, задушени ястия, тагин, глинтвайн',
    tip: 'Ceylon cinnamon is more delicate; Cassia is more intense and common in savoury dishes.', tipEl: 'Η κανέλα Κεϋλάνης είναι πιο λεπτή· η Κάσια είναι πιο έντονη και συνηθίζεται σε αλμυρά.', tipBg: 'Цейлонската канела е по-деликатна; касията е по-интензивна и се използва в солени ястия.',
  },
  {
    name: 'Turmeric', nameEl: 'Κουρκουμάς', nameBg: 'Куркума',
    category: 'spices', origin: 'India',
    flavour: 'Mild, earthy, slightly bitter, peppery', flavourEl: 'Ήπιο, γήινο, ελαφρώς πικρό', flavourBg: 'Мек, землист, леко горчив',
    uses: 'Curries, rice, marinades, golden milk', usesEl: 'Κάρι, ρύζι, μαρινάδες, χρυσό γάλα', usesBg: 'Къри, ориз, маринати, златно мляко',
    tip: 'Fat and black pepper increase bioavailability of curcumin by up to 2000%.', tipEl: 'Λίπος και μαύρο πιπέρι αυξάνουν την απορρόφηση κουρκουμίνης κατά 2000%.', tipBg: 'Мазнини и черен пипер увеличават усвояването на куркумин до 2000%.',
  },
  {
    name: 'Star Anise', nameEl: 'Αστεροειδής Γλυκάνισος', nameBg: 'Звезден Анасон',
    category: 'spices', origin: 'China / Vietnam',
    flavour: 'Intense liquorice, sweet, spiced', flavourEl: 'Έντονη γλυκόριζα, γλυκό, μυρωδάτο', flavourBg: 'Интензивен анасон, сладък, подправен',
    uses: 'Pho, Chinese five-spice, braised pork, mulled wine', usesEl: 'Φο, κινέζικο πεντάμπαχαρο, χοιρινό κατσαρόλας, ζεστό κρασί', usesBg: 'Фо, китайски пет подправки, задушено свинско, глинтвайн',
  },
  {
    name: 'Cardamom', nameEl: 'Κάρδαμο', nameBg: 'Кардамон',
    category: 'spices', origin: 'India / Guatemala',
    flavour: 'Floral, citrusy, minty, warm', flavourEl: 'Ανθώδες, εσπεριδοειδές, μινθώδες, ζεστό', flavourBg: 'Цветист, цитрусов, ментов, топъл',
    uses: 'Coffee, rice pilafs, chai, Scandinavian pastries', usesEl: 'Καφές, πιλάφι, τσάι μασάλα, σκανδιναβικά γλυκά', usesBg: 'Кафе, пилаф, чай масала, скандинавски сладкиши',
    tip: 'Use whole pods when infusing; crack and use seeds when grinding for maximum aroma.', tipEl: 'Χρησιμοποιείτε ολόκληρες κάψουλες για εκχύλιση· σπάστε για αλεσμένους σπόρους με μέγιστο άρωμα.', tipBg: 'Използвайте цели шушулки при инфузия; разчупете и използвайте семената при смилане.',
  },
  {
    name: 'Saffron', nameEl: 'Κρόκος Κοζάνης', nameBg: 'Шафран',
    category: 'spices', origin: 'Iran / Greece',
    flavour: 'Honey-like, floral, slightly metallic', flavourEl: 'Μελένιο, ανθώδες, ελαφρώς μεταλλικό', flavourBg: 'Медовиден, цветист, леко метален',
    uses: 'Paella, risotto Milanese, bouillabaisse, Persian rice', usesEl: 'Παέγια, ριζότο Μιλανέζε, μπουγιαμπέσα, περσικό ρύζι', usesBg: 'Паеля, ризото миланезе, буябес, персийски ориз',
    tip: 'Steep in warm water or broth for 15 min before adding — this "blooms" the flavour and colour.', tipEl: 'Μουσκεύετε σε χλιαρό νερό ή ζωμό 15 λεπτά πριν προσθέσετε — αναπτύσσει γεύση και χρώμα.', tipBg: 'Накиснете в топла вода или бульон за 15 мин преди добавяне — разцъфтява аромата и цвета.',
  },
  {
    name: 'Cloves', nameEl: 'Γαρύφαλλο', nameBg: 'Карамфил',
    category: 'spices', origin: 'Indonesia',
    flavour: 'Intensely sweet, warm, numbing', flavourEl: 'Εντόνως γλυκό, ζεστό, μουδιαστικό', flavourBg: 'Интензивно сладко, топло, леко вцепеняващо',
    uses: 'Mulled wine, braises, spice blends, pickling', usesEl: 'Ζεστό κρασί, κατσαρόλες, μίγματα μπαχαρικών, τουρσί', usesBg: 'Глинтвайн, задушени ястия, смеси подправки, мариноване',
    tip: 'Use sparingly — very potent. Stud an onion for stock; add whole to liquids and remove before serving.', tipEl: 'Χρησιμοποιείτε λίγο — είναι πολύ δυνατό. Μπήξτε σε κρεμμύδι για ζωμό· αφαιρείτε πριν σερβίρετε.', tipBg: 'Използвайте пестеливо — много силен. Набучете в лук за бульон; добавяйте цели и вадете преди сервиране.',
  },
  {
    name: 'Sumac', nameEl: 'Σούμακ', nameBg: 'Сумак',
    category: 'spices', origin: 'Middle East',
    flavour: 'Tangy, fruity, lemon-like', flavourEl: 'Ξινιστό, φρουτώδες, λεμονάτο', flavourBg: 'Кисел, плодов, лимонов',
    uses: 'Fattoush, za\'atar, chicken, lamb, flatbreads', usesEl: 'Φατούς, ζατάρ, κοτόπουλο, αρνί, πίτες', usesBg: 'Фатуш, заатар, пиле, агнешко, питки',
    tip: 'Substitute for lemon when you need acidity without extra liquid.', tipEl: 'Αντικατάσταση λεμονιού όταν θέλετε οξύτητα χωρίς επιπλέον υγρό.', tipBg: 'Заменя лимона, когато искате киселинност без допълнителна течност.',
  },
  // ── HERBS ────────────────────────────────────────────────────────────────
  {
    name: 'Basil', nameEl: 'Βασιλικός', nameBg: 'Босилек',
    category: 'herbs', origin: 'Southeast Asia / Mediterranean',
    flavour: 'Sweet, anise-like, peppery, fresh', flavourEl: 'Γλυκό, γλυκανισάτο, πιπεράτο, φρέσκο', flavourBg: 'Сладък, анасонов, пиперлив, свеж',
    uses: 'Pesto, caprese, pasta, pizza, soups', usesEl: 'Πέστο, καπρέζε, ζυμαρικά, πίτσα, σούπες', usesBg: 'Песто, капрезе, паста, пица, супи',
    tip: 'Add at the very end; heat destroys the delicate volatile oils rapidly.', tipEl: 'Προσθέτετε τελευταία· η ζέστη καταστρέφει γρήγορα τα ευαίσθητα έλαια.', tipBg: 'Добавяйте в самия край; топлината бързо унищожава деликатните ароматни масла.',
  },
  {
    name: 'Rosemary', nameEl: 'Δεντρολίβανο', nameBg: 'Розмарин',
    category: 'herbs', origin: 'Mediterranean',
    flavour: 'Resinous, piney, camphor, savoury', flavourEl: 'Ρητινώδες, πευκώδες, καμφορώδες, αλμυρό', flavourBg: 'Смолист, боров, камфоров, пикантен',
    uses: 'Roast lamb, potatoes, focaccia, compound butters', usesEl: 'Αρνί στο φούρνο, πατάτες, φοκάτσια, σύνθετα βούτυρα', usesBg: 'Печено агнешко, картофи, фокача, ароматно масло',
    tip: 'Strip from woody stems; pair with garlic and lemon. Works as a basting brush.', tipEl: 'Αφαιρείτε από τους ξυλώδεις κλαδίσκους· συνδυάζετε με σκόρδο και λεμόνι.', tipBg: 'Откъснете от дървените стъбла; съчетайте с чесън и лимон. Работи като четка за мазане.',
  },
  {
    name: 'Thyme', nameEl: 'Θυμάρι', nameBg: 'Мащерка',
    category: 'herbs', origin: 'Mediterranean',
    flavour: 'Earthy, minty, slightly floral, savoury', flavourEl: 'Γήινο, μινθώδες, ελαφρώς ανθώδες', flavourBg: 'Землист, ментов, леко цветист, пикантен',
    uses: 'Stocks, braises, roasted vegetables, compound butters', usesEl: 'Ζωμοί, κατσαρόλες, ψητά λαχανικά, σύνθετα βούτυρα', usesBg: 'Бульони, задушени ястия, печени зеленчуци, ароматно масло',
    tip: 'Woody stems can go into stocks whole and be fished out — no need to strip every leaf.', tipEl: 'Τα ξυλώδη στελέχη μπαίνουν ολόκληρα σε ζωμούς και αφαιρούνται — δεν χρειάζεται αποφύλλωση.', tipBg: 'Дървените стъбла може да се слагат цели в бульони и после да се вадят.',
  },
  {
    name: 'Oregano', nameEl: 'Ρίγανη', nameBg: 'Риган',
    category: 'herbs', origin: 'Mediterranean',
    flavour: 'Robust, slightly bitter, aromatic', flavourEl: 'Δυνατό, ελαφρώς πικρό, αρωματικό', flavourBg: 'Силен, леко горчив, ароматен',
    uses: 'Pizza, pasta sauces, Greek salad, marinades for lamb', usesEl: 'Πίτσα, σάλτσες ζυμαρικών, χωριάτικη σαλάτα, μαρινάδα για αρνί', usesBg: 'Пица, сосове за паста, гръцка салата, маринати за агнешко',
    tip: 'Dried oregano is more potent than fresh; rub between palms before use to release oils.', tipEl: 'Η αποξηραμένη ρίγανη είναι ισχυρότερη από τη φρέσκια· τρίψτε στις παλάμες για να απελευθερωθούν τα έλαια.', tipBg: 'Сухият риган е по-силен от пресния; разтрийте между дланите преди употреба.',
  },
  {
    name: 'Tarragon', nameEl: 'Εστραγκόν', nameBg: 'Естрагон',
    category: 'herbs', origin: 'Central Asia',
    flavour: 'Sweet anise, licorice, fresh, slight bitterness', flavourEl: 'Γλυκός γλυκάνισος, λικέρ, φρέσκο, ελαφρά πικρό', flavourBg: 'Сладък анасон, ликьор, свеж, леко горчив',
    uses: 'Béarnaise, chicken, eggs, fish, compound butters', usesEl: 'Μπεαρνέζ, κοτόπουλο, αυγά, ψάρι, σύνθετα βούτυρα', usesBg: 'Беарнез, пиле, яйца, риба, ароматно масло',
    tip: 'French tarragon is far superior to Russian for cooking; avoid drying it — use fresh or in vinegar.', tipEl: 'Το γαλλικό εστραγκόν είναι πολύ ανώτερο από το ρωσικό· χρησιμοποιείτε φρέσκο ή σε ξύδι.', tipBg: 'Френският естрагон е много по-добър от руския; избягвайте изсушаване — използвайте пресен или в оцет.',
  },
  {
    name: 'Sage', nameEl: 'Φασκόμηλο', nameBg: 'Градински Чай',
    category: 'herbs', origin: 'Mediterranean',
    flavour: 'Earthy, musty, warm, slightly bitter', flavourEl: 'Γήινο, στυφό, ζεστό, ελαφρώς πικρό', flavourBg: 'Землист, мухлясал, топъл, леко горчив',
    uses: 'Brown butter, gnocchi, pork, lamb, stuffings', usesEl: 'Καφέ βούτυρο, γκνόκι, χοιρινό, αρνί, γεμιστά', usesBg: 'Кафяво масло, ньоки, свинско, агнешко, плънки',
    tip: 'Fry whole leaves in brown butter until crisp for a classic Italian garnish.', tipEl: 'Τηγανίζετε ολόκληρα φύλλα σε καφέ βούτυρο μέχρι να γίνουν τραγανά — κλασικό ιταλικό γαρνίρισμα.', tipBg: 'Запържете цели листа в кафяво масло до хрупкавост — класична италианска гарнитура.',
  },
  {
    name: 'Dill', nameEl: 'Άνηθος', nameBg: 'Копър',
    category: 'herbs', origin: 'Mediterranean / Central Asia',
    flavour: 'Fresh, grassy, anise-like, slightly citrusy', flavourEl: 'Φρέσκο, χορτώδες, γλυκανισάτο, ελαφρώς λεμονάτο', flavourBg: 'Свеж, тревист, анасонов, леко цитрусов',
    uses: 'Pickles, salmon, tzatziki, potato salad, Scandinavian cuisine', usesEl: 'Τουρσί, σολομός, τζατζίκι, πατατοσαλάτα, σκανδιναβική κουζίνα', usesBg: 'Туршии, сьомга, дзадзики, картофена салата, скандинавска кухня',
    tip: 'Very delicate — add just before serving; pairs naturally with dairy (cream, yoghurt, sour cream).', tipEl: 'Πολύ ευαίσθητο — προσθέτετε αμέσως πριν σερβίρετε· συνδυάζεται φυσικά με γαλακτοκομικά.', tipBg: 'Много деликатен — добавяйте непосредствено преди сервиране; съчетава се естествено с млечни продукти.',
  },
  {
    name: 'Lemongrass', nameEl: 'Λεμονόχορτο', nameBg: 'Лимонена Трева',
    category: 'herbs', origin: 'Southeast Asia',
    flavour: 'Citrusy, floral, ginger-like, fresh', flavourEl: 'Λεμονάτο, ανθώδες, τζιντζερένιο, φρέσκο', flavourBg: 'Цитрусов, цветист, джинджифилов, свеж',
    uses: 'Thai curries, soups, marinades, herbal teas', usesEl: 'Ταϊλανδέζικα κάρι, σούπες, μαρινάδες, αφεψήματα', usesBg: 'Тайландски кърита, супи, маринати, билкови чайове',
    tip: 'Bruise the lower stalk to release aroma; remove before serving as the fibre is tough to chew.', tipEl: 'Χτυπήστε το κάτω τμήμα για να απελευθερωθεί το άρωμα· αφαιρείτε πριν σερβίρετε λόγω σκληρής ίνας.', tipBg: 'Натиснете долната дръжка за освобождаване на аромата; вадете преди сервиране — влакното е жилаво.',
  },
  // ── AROMATIC CHEESES ─────────────────────────────────────────────────────
  {
    name: 'Parmigiano-Reggiano', nameEl: 'Παρμεζάνα', nameBg: 'Пармиджано-Реджано',
    category: 'cheese', origin: 'Italy (Emilia-Romagna)',
    flavour: 'Nutty, umami-rich, salty, granular, crystalline', flavourEl: 'Ξηροκαρπώδες, πλούσιο σε ουμάμι, αλμυρό, κρυσταλλικό', flavourBg: 'Ядков, богат на умами, солен, зърнест, кристален',
    uses: 'Pasta, risotto, soups, gratins, salads', usesEl: 'Ζυμαρικά, ριζότο, σούπες, γκρατέν, σαλάτες', usesBg: 'Паста, ризото, супи, гратени, салати',
    tip: 'Use the rind in soups and stews — it melts in and adds umami. Never throw it away.', tipEl: 'Χρησιμοποιείτε τη φλούδα σε σούπες και φαγητά — λιώνει και δίνει ουμάμι. Μην την πετάτε ποτέ.', tipBg: 'Използвайте кората в супи и яхнии — разтапя се и добавя умами. Никога не я изхвърляйте.',
  },
  {
    name: 'Gruyère', nameEl: 'Γκρυγέρ', nameBg: 'Грюйер',
    category: 'cheese', origin: 'Switzerland',
    flavour: 'Nutty, creamy, slightly sweet, earthy', flavourEl: 'Ξηροκαρπώδες, κρεμώδες, ελαφρώς γλυκό, γήινο', flavourBg: 'Ядков, кремообразен, леко сладък, землист',
    uses: 'Fondue, croque monsieur, onion soup, quiche', usesEl: 'Φοντί, κρoκ-μεσιέ, σούπα κρεμμυδιού, κις', usesBg: 'Фондю, крок монсиьор, лучена супа, киш',
    tip: 'Melts exceptionally well without becoming greasy — ideal for gratins and fondues.', tipEl: 'Λιώνει εξαιρετικά χωρίς να γίνεται λιπαρό — ιδανικό για γκρατέν και φοντί.', tipBg: 'Топи се изключително добре без да ста мазен — идеален за гратени и фондю.',
  },
  {
    name: 'Pecorino Romano', nameEl: 'Πεκορίνο Ρομάνο', nameBg: 'Пекорино Романо',
    category: 'cheese', origin: 'Italy (Lazio, Sardinia)',
    flavour: 'Sharp, salty, tangy, grassy', flavourEl: 'Αιχμηρό, αλμυρό, ξινιστό, χορτώδες', flavourBg: 'Остър, солен, кисел, тревист',
    uses: 'Cacio e pepe, carbonara, amatriciana, Roman dishes', usesEl: 'Κάτσιο ε πέπε, καρμπονάρα, αματρίτσιανα, ρωμαϊκά πιάτα', usesBg: 'Качо е пепе, карбонара, аматричана, римски ястия',
    tip: 'Saltier than Parmesan — reduce salt in recipes accordingly. Made from sheep\'s milk.', tipEl: 'Πιο αλμυρό από παρμεζάνα — μειώστε αλάτι στις συνταγές. Παρασκευάζεται από πρόβειο γάλα.', tipBg: 'По-солено от пармезан — намалете солта в рецептите. Приготвя се от овче мляко.',
  },
  {
    name: 'Roquefort', nameEl: 'Ροκφόρ', nameBg: 'Рокфор',
    category: 'cheese', origin: 'France (Combalou caves)',
    flavour: 'Strong, sharp, tangy, salty, creamy, blue-veined', flavourEl: 'Δυνατό, αιχμηρό, ξινιστό, αλμυρό, κρεμώδες', flavourBg: 'Силен, остър, кисел, солен, кремообразен, синьовенест',
    uses: 'Salad dressings, pear & walnut salads, steaks, cheese boards', usesEl: 'Ντρέσινγκ σαλάτας, σαλάτα αχλαδιού και καρυδιού, μπριζόλες', usesBg: 'Дресинги, салата с круши и орехи, пържоли, дъска за сирена',
    tip: 'Made from sheep\'s milk. Soak in cream to tame sharpness; pair with sweet elements.', tipEl: 'Από πρόβειο γάλα. Μουλιάστε σε κρέμα για να μαλακώσει η γεύση· συνδυάζεται με γλυκά στοιχεία.', tipBg: 'От овче мляко. Накиснете в сметана за по-мека острота; съчетайте със сладки елементи.',
  },
  {
    name: 'Manchego', nameEl: 'Μανσέγκο', nameBg: 'Манчего',
    category: 'cheese', origin: 'Spain (La Mancha)',
    flavour: 'Buttery, mild, slightly tangy, grassy with herbal notes', flavourEl: 'Βουτυράτο, ήπιο, ελαφρώς ξινιστό, με φυτικές νότες', flavourBg: 'Маслен, мек, леко кисел, тревист с билкови нотки',
    uses: 'Tapas, cheese boards, quince paste (membrillo), sandwiches', usesEl: 'Τάπας, δίσκοι τυριών, μαρμελάδα κυδωνιού, σάντουιτς', usesBg: 'Тапас, дъска за сирена, дюлева паста (membrillo), сандвичи',
    tip: 'Pair with quince jelly and Marcona almonds for a classic Spanish combination.', tipEl: 'Συνδυάστε με ζελέ κυδωνιού και αμύγδαλα Μαρκόνα για κλασικό ισπανικό δίδυμο.', tipBg: 'Съчетайте с дюлево желе и бадеми Маркона за класическа испанска комбинация.',
  },
  {
    name: 'Gorgonzola', nameEl: 'Γκοργκονζόλα', nameBg: 'Горгонзола',
    category: 'cheese', origin: 'Italy (Lombardy)',
    flavour: 'Creamy, spicy, tangy, pungent (Piccante) or mild and sweet (Dolce)', flavourEl: 'Κρεμώδες, πικάντικο, ξινιστό (Piccante) ή ήπιο και γλυκό (Dolce)', flavourBg: 'Кремообразен, пикантен, кисел (Piccante) или мек и сладък (Dolce)',
    uses: 'Risotto, polenta, radicchio, pizza, pasta, gnocchi', usesEl: 'Ριζότο, πολέντα, ραντίκιο, πίτσα, ζυμαρικά, γκνόκι', usesBg: 'Ризото, полента, радичо, пица, паста, ньоки',
    tip: 'Gorgonzola Dolce melts creamy and smooth; Piccante has more bite — use each accordingly.', tipEl: 'Η Dolce λιώνει κρεμώδης· η Piccante έχει περισσότερη ένταση — χρησιμοποιείτε ανάλογα.', tipBg: 'Dolce се топи гладко и кремообразно; Piccante е по-остра — изберете според употребата.',
  },
  {
    name: 'Comté', nameEl: 'Κοντέ', nameBg: 'Конте',
    category: 'cheese', origin: 'France (Jura Mountains)',
    flavour: 'Complex: fruity, nutty, sweet, savoury, with floral finish', flavourEl: 'Σύνθετο: φρουτώδες, ξηροκαρπώδες, γλυκό, αλμυρό, με ανθώδες φινάλε', flavourBg: 'Комплексен: плодов, ядков, сладък, пикантен, с цветист финиш',
    uses: 'Cheese boards, fondue, croque monsieur, soufflés, grating', usesEl: 'Δίσκοι τυριών, φοντί, κρoκ-μεσιέ, σουφλέ, τρίψιμο', usesBg: 'Дъска за сирена, фондю, крок монсиьор, суфле, настъргване',
    tip: 'Flavour varies by season and cave — summer Comté is fruitier, winter is nuttier.', tipEl: 'Γεύση ποικίλει ανά εποχή και σπήλαιο — καλοκαιρινό Comté είναι πιο φρουτώδες, χειμερινό πιο ξηροκαρπώδες.', tipBg: 'Вкусът варира според сезона — летният Конте е по-плодов, зимният по-ядков.',
  },
  // ── OILS & VINEGARS ──────────────────────────────────────────────────────
  {
    name: 'Extra-Virgin Olive Oil', nameEl: 'Εξαιρετικό Παρθένο Ελαιόλαδο', nameBg: 'Екстра Върджин Зехтин',
    category: 'oils', origin: 'Mediterranean',
    flavour: 'Fruity, peppery, grassy, bitter (varies by variety)', flavourEl: 'Φρουτώδες, πιπεράτο, χορτώδες, πικρό (ποικίλει)', flavourBg: 'Плодов, пиперлив, тревист, горчив (варира)',
    uses: 'Dressings, finishing oils, dips, sautéing (up to ~180°C)', usesEl: 'Ντρέσινγκ, ελαιόλαδο φινιρίσματος, ντιπ, σοτάρισμα (~180°C)', usesBg: 'Дресинги, финиширащо масло, дипове, сотиране (~180°C)',
    tip: 'Buy in small quantities; store away from heat and light. Smoke point ~190°C — fine for most cooking.', tipEl: 'Αγοράστε μικρές ποσότητες· φυλάξτε μακριά από θερμότητα και φως. Σημείο καπνίσματος ~190°C.', tipBg: 'Купувайте малки количества; съхранявайте далеч от топлина и светлина. Точка на дим ~190°C.',
  },
  {
    name: 'Sesame Oil', nameEl: 'Σησαμέλαιο', nameBg: 'Сусамово Масло',
    category: 'oils', origin: 'Asia',
    flavour: 'Rich, nutty, toasted, intense', flavourEl: 'Πλούσιο, ξηροκαρπώδες, καβουρδισμένο, έντονο', flavourBg: 'Богато, ядково, препечено, интензивно',
    uses: 'Stir-fries, ramen, dressings, marinades, noodle dishes', usesEl: 'Στιρ-φράι, ράμεν, ντρέσινγκ, μαρινάδες, πιάτα με νουντλς', usesBg: 'Стир-фрай, рамен, дресинги, маринати, ястия с юфка',
    tip: 'Dark toasted sesame oil is a finishing oil only — do not cook with it at high heat.', tipEl: 'Το σκούρο καβουρδισμένο σησαμέλαιο χρησιμοποιείται μόνο για φινίρισμα — μην το μαγειρεύετε σε υψηλή θερμοκρασία.', tipBg: 'Тъмното препечено сусамово масло е само финиширащо — не го гответе на висока температура.',
  },
  {
    name: 'Balsamic Vinegar of Modena', nameEl: 'Βαλσάμικο Ξύδι Μοντένα', nameBg: 'Балсамов Оцет от Модена',
    category: 'oils', origin: 'Italy (Emilia-Romagna)',
    flavour: 'Sweet-sour, complex, syrupy (aged), tangy (young)', flavourEl: 'Γλυκόξινο, σύνθετο, σιροπιαστό (παλαιωμένο), ξινιστό (νέο)', flavourBg: 'Сладко-кисел, комплексен, сиропообразен (зрял), кисел (млад)',
    uses: 'Reductions, dressings, strawberries, aged parmigiano, pizza', usesEl: 'Ρεντουξιόν, ντρέσινγκ, φράουλες, παλαιωμένη παρμεζάνα, πίτσα', usesBg: 'Редукции, дресинги, ягоди, узрял пармезан, пица',
    tip: 'IGP (Indicazione Geografica Protetta) indicates origin but quality varies widely. Aceto Balsamico Tradizionale (DOP) is aged 12–25+ years.', tipEl: 'Το IGP δηλώνει γεωγραφική προέλευση αλλά η ποιότητα ποικίλει. Το Tradizionale DOP παλαιώνεται 12–25+ χρόνια.', tipBg: 'IGP означава защитено географско указание, но качеството варира. Tradizionale DOP се отлежава 12–25+ години.',
  },
  {
    name: 'Sherry Vinegar', nameEl: 'Ξύδι Σέρι', nameBg: 'Шери Оцет',
    category: 'oils', origin: 'Spain (Andalusia)',
    flavour: 'Nutty, complex, sweet-sharp, rich oak notes', flavourEl: 'Ξηροκαρπώδες, σύνθετο, γλυκύξινο, νότες δρυός', flavourBg: 'Ядков, комплексен, сладко-остър, нотки на дъб',
    uses: 'Gazpacho, vinaigrettes, pan sauces, braised meats, Spanish cuisine', usesEl: 'Γκαζπάτσο, βινεγκρέτ, σάλτσες τηγανιού, κρεατόσουπες, ισπανική κουζίνα', usesBg: 'Гаспачо, винегрет, сосове от тиган, задушени меса, испанска кухня',
    tip: 'Reserve de la Casa (1 yr), Reserve (2 yr), Gran Reserve (10+ yr) — the longer aged, the more complex.', tipEl: 'Reserve de la Casa (1 έτος), Reserve (2 έτη), Gran Reserve (10+ έτη) — όσο παλαιότερο, τόσο πιο σύνθετο.', tipBg: 'Reserve de la Casa (1 г.), Reserve (2 г.), Gran Reserve (10+ г.) — колкото по-старо, толкова по-сложно.',
  },
  {
    name: 'Rice Wine Vinegar', nameEl: 'Ρυζόξυδο', nameBg: 'Оризов Оцет',
    category: 'oils', origin: 'China / Japan',
    flavour: 'Mild, clean, slightly sweet, delicate', flavourEl: 'Ήπιο, καθαρό, ελαφρώς γλυκό, λεπτό', flavourBg: 'Мек, чист, леко сладък, деликатен',
    uses: 'Sushi rice, dipping sauces, dressings, pickled vegetables', usesEl: 'Ρύζι σούσι, σαλτσάκια για βούτηγμα, ντρέσινγκ, τουρσί λαχανικά', usesBg: 'Ориз за суши, сосове за потапяне, дресинги, маринован зеленчуци',
    tip: 'Much milder than Western vinegars (~4–5% acidity). Unseasoned for most cooking; seasoned already has sugar/salt.', tipEl: 'Πολύ πιο ήπιο από δυτικά ξύδια (~4–5% οξύτητα). Χωρίς ζάχαρη/αλάτι για μαγείρεμα· seasoned έχει ήδη αρωματιστεί.', tipBg: 'Много по-мек от западните оцети (~4–5% киселинност). Несезониран за готвене; сезонираният вече има захар/сол.',
  },
  {
    name: 'Walnut Oil', nameEl: 'Λάδι Καρυδιάς', nameBg: 'Орехово Масло',
    category: 'oils', origin: 'France / California',
    flavour: 'Rich, toasty walnut, slightly bitter, complex', flavourEl: 'Πλούσιο, καβουρδισμένο καρύδι, ελαφρώς πικρό, σύνθετο', flavourBg: 'Богато, препечен орех, леко горчиво, комплексно',
    uses: 'Vinaigrettes, pasta salads, drizzling over blue cheese, desserts', usesEl: 'Βινεγκρέτ, σαλάτες ζυμαρικών, πάνω από μπλε τυρί, επιδόρπια', usesBg: 'Винегрет, салати с паста, поливане над синьо сирене, десерти',
    tip: 'Goes rancid quickly — buy cold-pressed, keep refrigerated, use within 3 months. Do not heat above 160°C.', tipEl: 'Ταγγίζει γρήγορα — αγοράστε ψυχρής έκθλιψης, φυλάξτε στο ψυγείο, χρησιμοποιείτε εντός 3 μηνών. Μη θερμαίνετε πάνω από 160°C.', tipBg: 'Прогорква бързо — купувайте студено пресовано, дръжте в хладилник, употребете в рамките на 3 месеца.',
  },
  {
    name: 'Truffle Oil', nameEl: 'Λάδι Τρούφας', nameBg: 'Масло от Трюфел',
    category: 'oils', origin: 'Italy / France',
    flavour: 'Earthy, musky, umami, pungent, forest floor', flavourEl: 'Γήινο, μοσχάτο, ουμάμι, έντονο, αρωμα δάσους', flavourBg: 'Землист, мускусен, умами, пикантен, горски аромат',
    uses: 'Finishing drizzle on pasta, risotto, pizza, eggs, fries', usesEl: 'Φινίρισμα σε ζυμαρικά, ριζότο, πίτσα, αυγά, τηγανητές πατάτες', usesBg: 'Финиширащо поливане на паста, ризото, пица, яйца, пържени картофи',
    tip: 'Most truffle oil contains synthetic 2,4-dithiapentane rather than real truffle. Use as a finishing oil only — never cook with it.', tipEl: 'Τα περισσότερα λάδια τρούφας περιέχουν συνθετική 2,4-διθιαπεντάνη αντί πραγματικής τρούφας. Μόνο για φινίρισμα.', tipBg: 'Повечето масла от трюфел съдържат синтетичен 2,4-дитиапентан вместо истински трюфел. Само за финиширане.',
  },
]

const CATEGORIES: { id: Category | 'all'; labelKey: string; emoji: string }[] = [
  { id: 'all', labelKey: 'ingredients.all', emoji: '🔍' },
  { id: 'spices', labelKey: 'ingredients.spices', emoji: '🌶️' },
  { id: 'herbs', labelKey: 'ingredients.herbs', emoji: '🌿' },
  { id: 'cheese', labelKey: 'ingredients.cheese', emoji: '🧀' },
  { id: 'oils', labelKey: 'ingredients.oils', emoji: '🫙' },
]

function getLang(): 'en' | 'el' | 'bg' {
  const l = i18n.language
  if (l.startsWith('el')) return 'el'
  if (l.startsWith('bg')) return 'bg'
  return 'en'
}

export default function IngredientsEncyclopedia() {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [activeCategory, setActiveCategory] = useState<Category | 'all'>('all')

  const lang = getLang()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return ENTRIES.filter((e) => {
      if (activeCategory !== 'all' && e.category !== activeCategory) return false
      if (!q) return true
      const nameToSearch = lang === 'el' ? e.nameEl : lang === 'bg' ? e.nameBg : e.name
      return (
        e.name.toLowerCase().includes(q) ||
        nameToSearch.toLowerCase().includes(q)
      )
    })
  }, [search, activeCategory, lang])

  function entryName(e: IngredientEntry) {
    if (lang === 'el') return e.nameEl
    if (lang === 'bg') return e.nameBg
    return e.name
  }
  function entryFlavour(e: IngredientEntry) {
    if (lang === 'el') return e.flavourEl
    if (lang === 'bg') return e.flavourBg
    return e.flavour
  }
  function entryUses(e: IngredientEntry) {
    if (lang === 'el') return e.usesEl
    if (lang === 'bg') return e.usesBg
    return e.uses
  }
  function entryTip(e: IngredientEntry) {
    if (!e.tip) return null
    if (lang === 'el') return e.tipEl ?? null
    if (lang === 'bg') return e.tipBg ?? null
    return e.tip
  }

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold flex items-center gap-3">
          <BookOpen className="h-8 w-8 text-brand-orange" />
          {t('ingredients.title')}
        </h1>
        <p className="text-white/60 mt-1">{t('ingredients.subtitle')}</p>
      </header>

      {/* Search + filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-white/30 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('ingredients.searchPlaceholder')}
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:border-brand-orange/50 focus:bg-white/8 transition"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                'px-3 py-2 rounded-xl border text-sm font-medium transition whitespace-nowrap',
                activeCategory === cat.id
                  ? 'border-brand-orange bg-brand-orange/15 text-brand-orange'
                  : 'border-white/10 text-white/50 hover:border-white/25 hover:text-white/80 hover:bg-white/5',
              )}
            >
              <span className="mr-1">{cat.emoji}</span>{t(cat.labelKey)}
            </button>
          ))}
        </div>
      </div>

      {/* Count */}
      <p className="text-xs text-white/35">
        {t('ingredients.showing', { count: filtered.length, total: ENTRIES.length })}
      </p>

      {/* Grid */}
      {filtered.length === 0 ? (
        <GlassCard>
          <p className="text-center text-white/40 py-8">{t('ingredients.noResults')}</p>
        </GlassCard>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((entry) => {
            const tip = entryTip(entry)
            const categoryEmoji = CATEGORIES.find((c) => c.id === entry.category)?.emoji ?? ''
            return (
              <GlassCard key={entry.name} className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-semibold text-white leading-snug">{entryName(entry)}</h3>
                    {lang !== 'en' && (
                      <p className="text-xs text-white/40 mt-0.5 italic">{entry.name}</p>
                    )}
                  </div>
                  <span className="text-xl shrink-0">{categoryEmoji}</span>
                </div>

                {entry.origin && (
                  <p className="text-[11px] text-brand-orange/70 font-medium">
                    {t('ingredients.origin')}: {entry.origin}
                  </p>
                )}

                <div className="space-y-1.5">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">{t('ingredients.flavour')}</span>
                    <p className="text-sm text-white/75 mt-0.5">{entryFlavour(entry)}</p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-white/30 font-semibold">{t('ingredients.uses')}</span>
                    <p className="text-sm text-white/75 mt-0.5">{entryUses(entry)}</p>
                  </div>
                  {tip && (
                    <div className="bg-brand-orange/8 border border-brand-orange/20 rounded-lg px-3 py-2">
                      <span className="text-[10px] uppercase tracking-wider text-brand-orange/60 font-semibold">{t('ingredients.tip')}</span>
                      <p className="text-xs text-white/65 mt-0.5">{tip}</p>
                    </div>
                  )}
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}
    </div>
  )
}
