import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Scale, Thermometer, Shuffle, Calculator, Plus, Trash2, ArrowRight } from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { cn } from '../lib/cn'

type Tab = 'convert' | 'scale' | 'substitute' | 'temps'
type ConvertType = 'weight' | 'volume' | 'temp'

const WEIGHT: Record<string, { label: string; factor: number }> = {
  g:  { label: 'g',  factor: 1        },
  kg: { label: 'kg', factor: 1000     },
  oz: { label: 'oz', factor: 28.3495  },
  lb: { label: 'lb', factor: 453.592  },
}

const VOLUME: Record<string, { label: string; factor: number }> = {
  ml:    { label: 'ml',    factor: 1        },
  l:     { label: 'l',     factor: 1000     },
  fl_oz: { label: 'fl oz', factor: 29.5735  },
  cup:   { label: 'cup',   factor: 240      },
  tbsp:  { label: 'tbsp',  factor: 14.7868  },
  tsp:   { label: 'tsp',   factor: 4.92892  },
}

interface ScaleIngredient {
  id: string; name: string; amount: string; unit: string
}

interface Substitution {
  ingredient: string; ingredientEl: string; category: string
  subs: { label: string; labelEl: string; ratio: string; notes?: string; notesEl?: string }[]
}

const SUBSTITUTIONS: Substitution[] = [
  { ingredient: 'Buttermilk (1 cup)', ingredientEl: 'Βουτυρόγαλο (1 κούπα)', category: 'dairy', subs: [
    { label: 'Milk + lemon juice',   labelEl: 'Γάλα + χυμό λεμονιού',  ratio: '1 cup milk + 1 tbsp lemon juice', notes: 'Let sit 5 min',           notesEl: 'Αφήστε 5 λεπτά' },
    { label: 'Milk + white vinegar', labelEl: 'Γάλα + λευκό ξύδι',     ratio: '1 cup milk + 1 tbsp vinegar',     notes: 'Let sit 5 min',           notesEl: 'Αφήστε 5 λεπτά' },
    { label: 'Plain yogurt',         labelEl: 'Σκέτο γιαούρτι',         ratio: '1:1',                             notes: 'Thin with a little milk', notesEl: 'Αραιώστε με λίγο γάλα' },
  ]},
  { ingredient: 'Heavy cream (1 cup)', ingredientEl: 'Κρέμα γάλακτος (1 κούπα)', category: 'dairy', subs: [
    { label: 'Whole milk + butter', labelEl: 'Πλήρες γάλα + βούτυρο', ratio: '¾ cup milk + ⅓ cup melted butter' },
    { label: 'Coconut cream',       labelEl: 'Κρέμα καρύδας',          ratio: '1:1', notes: 'Best for sweet dishes', notesEl: 'Ιδανικό για γλυκά' },
    { label: 'Evaporated milk',     labelEl: 'Εβαπορέ γάλα',           ratio: '1:1' },
  ]},
  { ingredient: 'Sour cream', ingredientEl: 'Κρέμα ξινή', category: 'dairy', subs: [
    { label: 'Greek yogurt',  labelEl: 'Ελληνικό γιαούρτι', ratio: '1:1', notes: 'Best substitute — same texture', notesEl: 'Καλύτερη επιλογή — ίδια σύσταση' },
    { label: 'Crème fraîche', labelEl: 'Κρεμ φρες',          ratio: '1:1' },
  ]},
  { ingredient: 'Butter (1 cup)', ingredientEl: 'Βούτυρο (1 κούπα)', category: 'fats', subs: [
    { label: 'Neutral oil',      labelEl: 'Ουδέτερο λάδι',     ratio: '¾ cup oil' },
    { label: 'Coconut oil',      labelEl: 'Λάδι καρύδας',       ratio: '1:1', notes: 'Adds slight coconut flavour',      notesEl: 'Προσθέτει ελαφριά γεύση καρύδας' },
    { label: 'Avocado (baking)', labelEl: 'Αβοκάντο (ψήσιμο)', ratio: '1:1', notes: 'Reduces fat & adds moisture',        notesEl: 'Μειώνει λίπος & προσθέτει υγρασία' },
  ]},
  { ingredient: 'Egg (1 large)', ingredientEl: 'Αβγό (1 μεγάλο)', category: 'eggs', subs: [
    { label: 'Flax egg',      labelEl: 'Αβγό λιναριού',   ratio: '1 tbsp ground flax + 3 tbsp water', notes: 'Let sit 5 min — vegan',              notesEl: 'Αφήστε 5 λεπτά — vegan' },
    { label: 'Applesauce',    labelEl: 'Μηλόσαλτσα',      ratio: '¼ cup',                             notes: 'Best for moist bakes',              notesEl: 'Ιδανικό για υγρά κέικ' },
    { label: 'Mashed banana', labelEl: 'Μπανάνα λιωμένη', ratio: '¼ cup',                             notes: 'Adds banana flavour',               notesEl: 'Προσθέτει γεύση μπανάνας' },
    { label: 'Aquafaba',      labelEl: 'Ακουαφάμπα',       ratio: '3 tbsp (whole) / 2 tbsp (white)',   notes: 'Best for meringue/foams',           notesEl: 'Ιδανικό για μαρέγκα/αφρούς' },
  ]},
  { ingredient: 'All-Purpose Flour (1 cup)', ingredientEl: 'Αλεύρι για Όλες τις Χρήσεις (1 κούπα)', category: 'flour', subs: [
    { label: 'Bread flour',       labelEl: 'Αλεύρι για ψωμί',   ratio: '1:1',        notes: 'More gluten — chewier result',                notesEl: 'Περισσότερη γλουτένη — πιο μαστιχωτό' },
    { label: 'Cake flour',        labelEl: 'Αλεύρι για κέικ',   ratio: '1 cup + 2 tbsp', notes: 'More tender crumb',                      notesEl: 'Πιο τρυφερή ψίχα' },
    { label: 'Almond flour (GF)', labelEl: 'Αλεύρι αμυγδάλου (χ/γλ)', ratio: '1:1', notes: 'Add ¼ tsp xanthan gum for binding',      notesEl: 'Προσθέστε ¼ κ.γλ. xanthan gum για δέσιμο' },
    { label: 'Oat flour (GF)',    labelEl: 'Αλεύρι βρώμης (χ/γλ)',     ratio: '1⅓ cup', notes: 'Slightly denser',                      notesEl: 'Ελαφρώς πιο πυκνό' },
  ]},
  { ingredient: 'Sugar (1 cup)', ingredientEl: 'Ζάχαρη (1 κούπα)', category: 'sweeteners', subs: [
    { label: 'Honey',         labelEl: 'Μέλι',            ratio: '¾ cup', notes: 'Reduce other liquids by 3 tbsp; lower oven by 15°C', notesEl: 'Μειώστε υγρά κατά 3 κ.σ.· χαμηλώστε φούρνο 15°C' },
    { label: 'Maple syrup',   labelEl: 'Σιρόπι σφενδάμου', ratio: '¾ cup', notes: 'Same reduction as honey',                          notesEl: 'Ίδια μείωση με το μέλι' },
    { label: 'Coconut sugar', labelEl: 'Ζάχαρη καρύδας',   ratio: '1:1',  notes: 'Slightly less sweet, caramel notes',                notesEl: 'Ελαφρώς λιγότερο γλυκό, νότες καραμέλας' },
  ]},
  { ingredient: 'Baking powder (1 tsp)', ingredientEl: 'Μπέικιν πάουντερ (1 κ.γλ.)', category: 'leavening', subs: [
    { label: 'Baking soda + cream of tartar', labelEl: 'Σόδα + ταρτάρ', ratio: '¼ tsp baking soda + ½ tsp cream of tartar' },
  ]},
  { ingredient: 'Cooking wine (1 cup)', ingredientEl: 'Κρασί για μαγείρεμα (1 κούπα)', category: 'liquids', subs: [
    { label: 'Stock + acid',  labelEl: 'Ζωμός + οξύ',     ratio: '1 cup stock + 1 tbsp lemon juice or vinegar' },
    { label: 'Grape juice',   labelEl: 'Χυμός σταφυλιού', ratio: '1:1', notes: 'For sweet wine substitute', notesEl: 'Για γλυκόξινο αποτέλεσμα' },
  ]},
  { ingredient: 'Breadcrumbs (1 cup)', ingredientEl: 'Τριμμένη φρυγανιά (1 κούπα)', category: 'pantry', subs: [
    { label: 'Rolled oats (pulsed)', labelEl: 'Βρώμη χοντροτριμμένη',  ratio: '1:1' },
    { label: 'Panko',                labelEl: 'Πάνκο',                  ratio: '1:1', notes: 'Crispier result',  notesEl: 'Πιο τραγανό αποτέλεσμα' },
    { label: 'Almond flour',         labelEl: 'Αλεύρι αμυγδάλου',      ratio: '1:1', notes: 'GF option',        notesEl: 'Επιλογή χωρίς γλουτένη' },
  ]},
  { ingredient: 'Vinegar (1 tbsp)', ingredientEl: 'Ξύδι (1 κ.σ.)', category: 'pantry', subs: [
    { label: 'Lemon or lime juice', labelEl: 'Χυμός λεμονιού ή lime', ratio: '1 tbsp' },
    { label: 'White wine vinegar',  labelEl: 'Ξύδι λευκού κρασιού',   ratio: '1:1', notes: 'Milder acidity', notesEl: 'Πιο ήπια οξύτητα' },
  ]},
]

const SUB_CATEGORIES = ['all', 'dairy', 'fats', 'eggs', 'flour', 'sweeteners', 'leavening', 'liquids', 'pantry']

interface MeatTemp  { meat: string; meatEl: string; c: number; f: number; note: string; noteEl: string }
interface OvenTemp  { label: string; labelEl: string; c: number; f: number; gas: string }
interface SmokePoint { oil: string; oilEl: string; c: number; f: number; note: string; noteEl: string }

const MEAT_TEMPS: MeatTemp[] = [
  { meat: 'Beef — Rare',        meatEl: 'Μοσχάρι — Saignant',     c: 52, f: 125, note: 'Cool red center',        noteEl: 'Κρύο κόκκινο κέντρο' },
  { meat: 'Beef — Medium Rare', meatEl: 'Μοσχάρι — Medium Rare',  c: 57, f: 135, note: 'Warm red center',        noteEl: 'Ζεστό κόκκινο κέντρο' },
  { meat: 'Beef — Medium',      meatEl: 'Μοσχάρι — Medium',       c: 63, f: 145, note: 'Warm pink center',       noteEl: 'Ζεστό ροζ κέντρο' },
  { meat: 'Beef — Well Done',   meatEl: 'Μοσχάρι — Well Done',    c: 71, f: 160, note: 'No pink',               noteEl: 'Χωρίς ροζ' },
  { meat: 'Chicken / Turkey',   meatEl: 'Κοτόπουλο / Γαλοπούλα', c: 74, f: 165, note: 'Juices run clear',       noteEl: 'Χυμοί τρέχουν διαυγείς' },
  { meat: 'Pork',               meatEl: 'Χοιρινό',                c: 63, f: 145, note: '3 min rest minimum',     noteEl: 'Τουλάχιστον 3 λεπτά ξεκούραση' },
  { meat: 'Lamb (medium)',       meatEl: 'Αρνί (μέτριο)',          c: 63, f: 145, note: 'Pink center',           noteEl: 'Ροζ κέντρο' },
  { meat: 'Fish & Shellfish',   meatEl: 'Ψάρι & Θαλασσινά',      c: 63, f: 145, note: 'Flakes easily',          noteEl: 'Ξεφλουδίζει εύκολα' },
  { meat: 'Ground Meat',        meatEl: 'Κιμάς',                  c: 71, f: 160, note: 'All ground meats',       noteEl: 'Όλοι οι κιμάδες' },
  { meat: 'Duck',               meatEl: 'Πάπια',                  c: 74, f: 165, note: 'Breast can be 57°C (med-rare)', noteEl: 'Στήθος μπορεί να είναι 57°C' },
]

const OVEN_TEMPS: OvenTemp[] = [
  { label: 'Very Low',      labelEl: 'Πολύ χαμηλός',      c: 120, f: 250, gas: '½' },
  { label: 'Low',           labelEl: 'Χαμηλός',           c: 150, f: 300, gas: '2'  },
  { label: 'Moderate-Low',  labelEl: 'Μέτριος-χαμηλός',   c: 160, f: 325, gas: '3'  },
  { label: 'Moderate',      labelEl: 'Μέτριος',            c: 180, f: 350, gas: '4'  },
  { label: 'Moderate-Hot',  labelEl: 'Μέτριος-δυνατός',   c: 190, f: 375, gas: '5'  },
  { label: 'Hot',           labelEl: 'Δυνατός',            c: 200, f: 400, gas: '6'  },
  { label: 'Very Hot',      labelEl: 'Πολύ δυνατός',       c: 220, f: 425, gas: '7'  },
  { label: 'Extremely Hot', labelEl: 'Εξαιρετικά δυνατός', c: 230, f: 450, gas: '8'  },
  { label: 'Broil / Grill', labelEl: 'Γκριλ / Σχάρα',     c: 260, f: 500, gas: '9'  },
]

const SMOKE_POINTS: SmokePoint[] = [
  { oil: 'Butter',                   oilEl: 'Βούτυρο',                   c: 150, f: 302, note: 'Low–medium heat only',    noteEl: 'Μόνο χαμηλή–μέτρια φωτιά' },
  { oil: 'Coconut Oil',              oilEl: 'Λάδι καρύδας',              c: 177, f: 350, note: 'Medium heat',             noteEl: 'Μέτρια φωτιά' },
  { oil: 'Sesame Oil (toasted)',     oilEl: 'Σησαμέλαιο (καβουρδιστό)', c: 177, f: 350, note: 'Finishing only',          noteEl: 'Μόνο για φινίρισμα' },
  { oil: 'Extra Virgin Olive Oil',   oilEl: 'Εξαιρετικό παρθένο ελαιόλαδο', c: 190, f: 375, note: 'Sauté, dressings',  noteEl: 'Σοτάρισμα, σαλάτες' },
  { oil: 'Canola / Rapeseed',        oilEl: 'Κανόλα / Ρεπάνι',          c: 204, f: 400, note: 'All-purpose cooking',    noteEl: 'Γενικής χρήσης' },
  { oil: 'Vegetable Oil',            oilEl: 'Φυτικό λάδι',               c: 204, f: 400, note: 'Deep frying, baking',    noteEl: 'Τηγάνισμα, ψήσιμο' },
  { oil: 'Sunflower Oil',            oilEl: 'Ηλιέλαιο',                  c: 227, f: 440, note: 'Deep frying, stir-fry',  noteEl: 'Βαθύ τηγάνισμα, stir-fry' },
  { oil: 'Refined Olive Oil',        oilEl: 'Ραφινέ ελαιόλαδο',          c: 240, f: 465, note: 'High-heat sauté',        noteEl: 'Σοτάρισμα σε δυνατή φωτιά' },
  { oil: 'Clarified Butter (Ghee)',  oilEl: 'Διαυγασμένο βούτυρο (Γκι)', c: 250, f: 482, note: 'High-heat cooking',     noteEl: 'Μαγείρεμα σε δυνατή φωτιά' },
  { oil: 'Avocado Oil',              oilEl: 'Λάδι αβοκάντο',             c: 271, f: 520, note: 'Highest smoke point',    noteEl: 'Υψηλότερο σημείο καύσης' },
]

function fmt(n: number): string {
  if (!isFinite(n)) return '—'
  return n % 1 === 0 ? String(n) : parseFloat(n.toFixed(3)).toString()
}

let _id = 0
function uid() { return String(++_id) }

export default function CulinaryTools() {
  const { t, i18n } = useTranslation()
  const isEl = i18n.language.startsWith('el')

  const [tab, setTab]           = useState<Tab>('convert')
  const [ctype, setCtype]       = useState<ConvertType>('weight')
  const [fromUnit, setFromUnit] = useState('g')
  const [toUnit, setToUnit]     = useState('oz')
  const [inputVal, setInputVal] = useState('100')

  const [baseYield, setBaseYield]       = useState(4)
  const [targetYield, setTargetYield]   = useState(8)
  const [ingredients, setIngredients]   = useState<ScaleIngredient[]>([
    { id: uid(), name: '', amount: '', unit: 'g' },
  ])

  const [subCat, setSubCat]       = useState('all')
  const [subSearch, setSubSearch] = useState('')

  function convert() {
    const n = parseFloat(inputVal)
    if (isNaN(n)) return '—'
    if (ctype === 'weight') return fmt(n * (WEIGHT[fromUnit]?.factor ?? 1) / (WEIGHT[toUnit]?.factor ?? 1))
    if (ctype === 'volume') return fmt(n * (VOLUME[fromUnit]?.factor ?? 1) / (VOLUME[toUnit]?.factor ?? 1))
    if (fromUnit === '°C' && toUnit === '°F') return fmt(n * 9 / 5 + 32)
    if (fromUnit === '°F' && toUnit === '°C') return fmt((n - 32) * 5 / 9)
    return fmt(n)
  }

  function switchConvType(next: ConvertType) {
    setCtype(next)
    if (next === 'weight') { setFromUnit('g');  setToUnit('oz')  }
    if (next === 'volume') { setFromUnit('ml'); setToUnit('cup') }
    if (next === 'temp')   { setFromUnit('°C'); setToUnit('°F')  }
  }

  const unitMap: Record<string, { label: string; factor?: number }> = ctype === 'weight' ? WEIGHT : ctype === 'volume' ? VOLUME
    : { '°C': { label: '°C' }, '°F': { label: '°F' } }

  const scaleFactor = baseYield > 0 && targetYield > 0 ? targetYield / baseYield : 1

  function addIngredient() {
    setIngredients((p) => [...p, { id: uid(), name: '', amount: '', unit: 'g' }])
  }
  function removeIngredient(id: string) {
    setIngredients((p) => p.filter((i) => i.id !== id))
  }
  function updateIngredient(id: string, field: keyof ScaleIngredient, value: string) {
    setIngredients((p) => p.map((i) => i.id === id ? { ...i, [field]: value } : i))
  }

  const filteredSubs = SUBSTITUTIONS.filter((s) => {
    const matchCat = subCat === 'all' || s.category === subCat
    const q = subSearch.toLowerCase()
    const name = isEl ? s.ingredientEl : s.ingredient
    return matchCat && (!q || name.toLowerCase().includes(q))
  })

  const tabs = [
    { id: 'convert'    as Tab, label: t('culinaryTools.tabs.convert'),    icon: Scale },
    { id: 'scale'      as Tab, label: t('culinaryTools.tabs.scale'),      icon: Calculator },
    { id: 'substitute' as Tab, label: t('culinaryTools.tabs.substitute'), icon: Shuffle },
    { id: 'temps'      as Tab, label: t('culinaryTools.tabs.temps'),      icon: Thermometer },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t('culinaryTools.title')}</h1>
        <p className="text-sm text-white/40 mt-1">{t('culinaryTools.subtitle')}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} type="button" onClick={() => setTab(id)}
            className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all',
              tab === id ? 'bg-brand-orange text-white shadow-[0_0_12px_rgba(196,149,106,0.4)]'
                         : 'glass text-white/50 hover:text-white/80')}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ── CONVERT ── */}
      {tab === 'convert' && (
        <GlassCard className="space-y-6">
          <div className="flex gap-2">
            {(['weight', 'volume', 'temp'] as ConvertType[]).map((ct) => (
              <button key={ct} type="button" onClick={() => switchConvType(ct)}
                className={cn('px-3 py-1.5 rounded-lg text-xs font-medium transition',
                  ctype === ct ? 'bg-white/15 text-white' : 'text-white/40 hover:text-white/60')}>
                {t(`culinaryTools.convert.${ct}`)}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/40">{t('culinaryTools.convert.amount')}</label>
              <input type="number" value={inputVal} onChange={(e) => setInputVal(e.target.value)}
                className="glass rounded-xl px-4 py-2.5 text-lg font-semibold text-white w-32 outline-none focus:ring-1 focus:ring-brand-orange/50" />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/40">{t('culinaryTools.convert.from')}</label>
              <select value={fromUnit} onChange={(e) => setFromUnit(e.target.value)}
                className="glass rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-brand-orange/50 cursor-pointer">
                {Object.entries(unitMap).map(([k, v]) => (
                  <option key={k} value={k} className="bg-neutral-900">{v.label}</option>
                ))}
              </select>
            </div>
            <ArrowRight className="h-5 w-5 text-white/20 mt-5 shrink-0" />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/40">{t('culinaryTools.convert.to')}</label>
              <select value={toUnit} onChange={(e) => setToUnit(e.target.value)}
                className="glass rounded-xl px-3 py-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-brand-orange/50 cursor-pointer">
                {Object.entries(unitMap).map(([k, v]) => (
                  <option key={k} value={k} className="bg-neutral-900">{v.label}</option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1 ml-4">
              <label className="text-xs text-white/40">{t('culinaryTools.convert.result')}</label>
              <div className="rounded-xl bg-brand-orange/10 border border-brand-orange/30 px-6 py-2.5 text-xl font-bold text-brand-orange min-w-[120px] text-center">
                {convert()} <span className="text-sm font-normal">{unitMap[toUnit]?.label}</span>
              </div>
            </div>
          </div>

          {ctype === 'weight' && (
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-2">{isEl ? 'Γρήγορη Αναφορά' : 'Quick Reference'}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[['1 oz','28 g'],['1 lb','454 g'],['1 kg','2.2 lb'],['100 g','3.5 oz']].map(([a,b]) => (
                  <div key={a} className="glass rounded-lg px-3 py-2 text-xs text-white/60 flex justify-between">
                    <span>{a}</span><span className="text-white/40">=</span><span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {ctype === 'volume' && (
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-2">{isEl ? 'Γρήγορη Αναφορά' : 'Quick Reference'}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[['1 cup','240 ml'],['1 tbsp','15 ml'],['1 tsp','5 ml'],['1 fl oz','30 ml']].map(([a,b]) => (
                  <div key={a} className="glass rounded-lg px-3 py-2 text-xs text-white/60 flex justify-between">
                    <span>{a}</span><span className="text-white/40">=</span><span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {ctype === 'temp' && (
            <div>
              <p className="text-xs text-white/30 uppercase tracking-wider mb-2">{isEl ? 'Γρήγορη Αναφορά' : 'Quick Reference'}</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[['0°C','32°F'],['100°C','212°F'],['180°C','356°F'],['220°C','428°F']].map(([a,b]) => (
                  <div key={a} className="glass rounded-lg px-3 py-2 text-xs text-white/60 flex justify-between">
                    <span>{a}</span><span className="text-white/40">=</span><span>{b}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      )}

      {/* ── SCALE ── */}
      {tab === 'scale' && (
        <GlassCard className="space-y-6">
          <p className="text-sm text-white/40">{t('culinaryTools.scale.tip')}</p>
          <div className="flex items-end gap-4 flex-wrap">
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/40">{t('culinaryTools.scale.original')}</label>
              <div className="flex items-center gap-2">
                <input type="number" min={1} value={baseYield}
                  onChange={(e) => setBaseYield(Math.max(1, Number(e.target.value)))}
                  className="glass rounded-xl px-3 py-2 text-base font-semibold text-white w-20 outline-none focus:ring-1 focus:ring-brand-orange/50" />
                <span className="text-sm text-white/40">{t('culinaryTools.scale.servings')}</span>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 text-white/20 mb-2.5 shrink-0" />
            <div className="flex flex-col gap-1">
              <label className="text-xs text-white/40">{t('culinaryTools.scale.target')}</label>
              <div className="flex items-center gap-2">
                <input type="number" min={1} value={targetYield}
                  onChange={(e) => setTargetYield(Math.max(1, Number(e.target.value)))}
                  className="glass rounded-xl px-3 py-2 text-base font-semibold text-white w-20 outline-none focus:ring-1 focus:ring-brand-orange/50" />
                <span className="text-sm text-white/40">{t('culinaryTools.scale.servings')}</span>
              </div>
            </div>
            <div className="flex flex-col gap-1 ml-4">
              <label className="text-xs text-white/40">{t('culinaryTools.scale.factor')}</label>
              <div className="rounded-xl bg-brand-orange/10 border border-brand-orange/30 px-4 py-2 text-lg font-bold text-brand-orange">
                ×{fmt(scaleFactor)}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-sm font-medium text-white/60">{t('culinaryTools.scale.ingredients')}</p>
            {ingredients.map((ing) => {
              const scaled = ing.amount ? fmt(parseFloat(ing.amount) * scaleFactor) : '—'
              return (
                <div key={ing.id} className="flex items-center gap-2 glass rounded-xl px-3 py-2">
                  <input type="text" placeholder={t('culinaryTools.scale.name')} value={ing.name}
                    onChange={(e) => updateIngredient(ing.id, 'name', e.target.value)}
                    className="flex-1 bg-transparent outline-none text-sm text-white placeholder:text-white/25 min-w-0" />
                  <input type="number" placeholder="0" value={ing.amount}
                    onChange={(e) => updateIngredient(ing.id, 'amount', e.target.value)}
                    className="bg-transparent outline-none text-sm text-white w-16 text-right" />
                  <input type="text" placeholder={t('culinaryTools.scale.unit')} value={ing.unit}
                    onChange={(e) => updateIngredient(ing.id, 'unit', e.target.value)}
                    className="bg-transparent outline-none text-sm text-white/60 w-12" />
                  <ArrowRight className="h-3.5 w-3.5 text-white/20 shrink-0" />
                  <span className="text-sm font-semibold text-brand-orange w-16 text-right tabular-nums">{scaled}</span>
                  <span className="text-sm text-white/40 w-12">{ing.unit}</span>
                  <button type="button" onClick={() => removeIngredient(ing.id)}
                    className="text-white/20 hover:text-red-400 transition p-1">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )
            })}
            <button type="button" onClick={addIngredient}
              className="flex items-center gap-2 text-sm text-white/40 hover:text-white/70 transition px-3 py-1.5">
              <Plus className="h-4 w-4" />
              {t('culinaryTools.scale.addIngredient')}
            </button>
          </div>
        </GlassCard>
      )}

      {/* ── SUBSTITUTE ── */}
      {tab === 'substitute' && (
        <div className="space-y-4">
          <div className="flex flex-col gap-3">
            <input type="text" placeholder={t('culinaryTools.substitute.search')} value={subSearch}
              onChange={(e) => setSubSearch(e.target.value)}
              className="glass rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:ring-1 focus:ring-brand-orange/50 w-full max-w-sm" />
            <div className="flex flex-wrap gap-2">
              {SUB_CATEGORIES.map((cat) => (
                <button key={cat} type="button" onClick={() => setSubCat(cat)}
                  className={cn('px-3 py-1 rounded-full text-xs font-medium transition',
                    subCat === cat ? 'bg-brand-orange text-white' : 'glass text-white/50 hover:text-white/80')}>
                  {t(`culinaryTools.substitute.${cat}`)}
                </button>
              ))}
            </div>
          </div>

          {filteredSubs.length === 0 ? (
            <p className="text-center text-sm text-white/30 py-10">{t('culinaryTools.substitute.noResults')}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {filteredSubs.map((s) => (
                <GlassCard key={s.ingredient} className="space-y-3 !p-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-sm text-white">{isEl ? s.ingredientEl : s.ingredient}</p>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/8 text-white/40 shrink-0">
                      {t(`culinaryTools.substitute.${s.category}`)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {s.subs.map((sub, i) => (
                      <div key={i} className="glass rounded-lg px-3 py-2">
                        <div className="flex items-baseline gap-2">
                          <span className="text-xs text-white/40 shrink-0">{t('culinaryTools.substitute.use')}</span>
                          <span className="text-sm font-medium text-white/90">{isEl ? sub.labelEl : sub.label}</span>
                        </div>
                        <p className="text-xs text-brand-orange mt-0.5">{sub.ratio}</p>
                        {(isEl ? sub.notesEl : sub.notes) && (
                          <p className="text-xs text-white/40 mt-0.5 italic">{isEl ? sub.notesEl : sub.notes}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── TEMPS ── */}
      {tab === 'temps' && (
        <div className="space-y-6">
          <GlassCard className="space-y-4">
            <h2 className="font-semibold text-white/80">{t('culinaryTools.temps.meat')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-white/30 uppercase tracking-wider border-b border-white/8">
                    <th className="text-left pb-2 font-medium">{t('culinaryTools.temps.meatCol')}</th>
                    <th className="text-center pb-2 font-medium">{t('culinaryTools.temps.celsius')}</th>
                    <th className="text-center pb-2 font-medium">{t('culinaryTools.temps.fahrenheit')}</th>
                    <th className="text-left pb-2 font-medium pl-4">{t('culinaryTools.temps.noteCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {MEAT_TEMPS.map((r) => (
                    <tr key={r.meat} className="hover:bg-white/3 transition">
                      <td className="py-2.5 text-white/80 font-medium">{isEl ? r.meatEl : r.meat}</td>
                      <td className="py-2.5 text-center font-mono text-brand-orange font-semibold">{r.c}°C</td>
                      <td className="py-2.5 text-center font-mono text-white/50">{r.f}°F</td>
                      <td className="py-2.5 text-white/40 text-xs pl-4">{isEl ? r.noteEl : r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <GlassCard className="space-y-4">
            <h2 className="font-semibold text-white/80">{t('culinaryTools.temps.oven')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-white/30 uppercase tracking-wider border-b border-white/8">
                    <th className="text-left pb-2 font-medium">{isEl ? 'Περιγραφή' : 'Description'}</th>
                    <th className="text-center pb-2 font-medium">{t('culinaryTools.temps.celsius')}</th>
                    <th className="text-center pb-2 font-medium">{t('culinaryTools.temps.fahrenheit')}</th>
                    <th className="text-center pb-2 font-medium">{t('culinaryTools.temps.gasmark')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {OVEN_TEMPS.map((r) => (
                    <tr key={r.label} className="hover:bg-white/3 transition">
                      <td className="py-2.5 text-white/80">{isEl ? r.labelEl : r.label}</td>
                      <td className="py-2.5 text-center font-mono text-brand-orange font-semibold">{r.c}°C</td>
                      <td className="py-2.5 text-center font-mono text-white/50">{r.f}°F</td>
                      <td className="py-2.5 text-center text-white/40">{r.gas}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>

          <GlassCard className="space-y-4">
            <h2 className="font-semibold text-white/80">{t('culinaryTools.temps.smoke')}</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-white/30 uppercase tracking-wider border-b border-white/8">
                    <th className="text-left pb-2 font-medium">{t('culinaryTools.temps.oilCol')}</th>
                    <th className="text-center pb-2 font-medium">{t('culinaryTools.temps.celsius')}</th>
                    <th className="text-center pb-2 font-medium">{t('culinaryTools.temps.fahrenheit')}</th>
                    <th className="text-left pb-2 font-medium pl-4">{t('culinaryTools.temps.useCol')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {SMOKE_POINTS.map((r) => (
                    <tr key={r.oil} className="hover:bg-white/3 transition">
                      <td className="py-2.5 text-white/80 font-medium">{isEl ? r.oilEl : r.oil}</td>
                      <td className="py-2.5 text-center font-mono text-brand-orange font-semibold">{r.c}°C</td>
                      <td className="py-2.5 text-center font-mono text-white/50">{r.f}°F</td>
                      <td className="py-2.5 text-white/40 text-xs pl-4">{isEl ? r.noteEl : r.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </GlassCard>
        </div>
      )}
    </div>
  )
}
