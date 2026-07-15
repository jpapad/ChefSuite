import { useState } from 'react'
import { Flame } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '../components/ui/GlassCard'
import { cn } from '../lib/cn'
import { useLibraryNote } from '../hooks/useLibraryNote'

interface Spice {
  name: string
  nameEl: string
  emoji: string
  flavor: string
  flavorEl: string
  intensity: 1 | 2 | 3
  uses: string[]
  usesEl: string[]
  pairs: string[]
  pairsEl: string[]
  tip?: string
  tipEl?: string
}

const SPICES: Spice[] = [
  {
    name: 'Black Pepper', nameEl: 'Μαύρο Πιπέρι', emoji: '⚫',
    flavor: 'Pungent, sharp, earthy', flavorEl: 'Πικάντικο, αιχμηρό, γήινο',
    intensity: 2,
    uses: ['Seasoning meats', 'Sauces', 'Pasta', 'Eggs'],
    usesEl: ['Καρύκευμα κρεάτων', 'Σάλτσες', 'Ζυμαρικά', 'Αβγά'],
    pairs: ['Salt', 'Lemon', 'Butter', 'Garlic'],
    pairsEl: ['Αλάτι', 'Λεμόνι', 'Βούτυρο', 'Σκόρδο'],
    tip: 'Crack just before serving — pre-ground loses most aroma within days.',
    tipEl: 'Σπάστε ακριβώς πριν σερβίρετε — αλεσμένο χάνει το άρωμά του μέσα σε μέρες.',
  },
  {
    name: 'Cumin', nameEl: 'Κύμινο', emoji: '🌾',
    flavor: 'Warm, earthy, nutty, slightly bitter', flavorEl: 'Ζεστό, γήινο, ξηρό, ελαφρώς πικρό',
    intensity: 2,
    uses: ['Meat rubs', 'Legumes', 'Tagines', 'Falafel'],
    usesEl: ['Μαρινάδες κρεάτων', 'Όσπρια', 'Ταζίν', 'Φαλάφελ'],
    pairs: ['Coriander', 'Chilli', 'Garlic', 'Turmeric'],
    pairsEl: ['Κόλιανδρος', 'Τσίλι', 'Σκόρδο', 'Κουρκουμάς'],
    tip: 'Toast whole seeds in a dry pan before grinding to amplify flavour significantly.',
    tipEl: 'Καβουρντίστε τους ολόκληρους σπόρους σε στεγνό τηγάνι πριν τους αλέσετε για εντονότερη γεύση.',
  },
  {
    name: 'Paprika', nameEl: 'Πάπρικα', emoji: '🌶️',
    flavor: 'Sweet, smoky or sharp depending on type', flavorEl: 'Γλυκό, καπνιστό ή αιχμηρό ανάλογα τον τύπο',
    intensity: 2,
    uses: ['Chicken', 'Stews', 'Devilled eggs', 'Rice dishes'],
    usesEl: ['Κοτόπουλο', 'Στιφάδα', 'Αβγά ντεβιλέ', 'Πιλάφια'],
    pairs: ['Onion', 'Garlic', 'Oil', 'Tomato'],
    pairsEl: ['Κρεμμύδι', 'Σκόρδο', 'Λάδι', 'Ντομάτα'],
    tip: 'Bloom paprika in hot oil for 30 seconds to wake up its colour and sweet depth.',
    tipEl: 'Μαγειρέψτε σε ζεστό λάδι 30 δευτερόλεπτα για να αναδείξετε το χρώμα και το βάθος γεύσης.',
  },
  {
    name: 'Cinnamon', nameEl: 'Κανέλα', emoji: '🌰',
    flavor: 'Sweet, warm, slightly woody', flavorEl: 'Γλυκό, ζεστό, ελαφρώς ξυλώδες',
    intensity: 2,
    uses: ['Pastries', 'Lamb dishes', 'Rice', 'Hot chocolate'],
    usesEl: ['Γλυκίσματα', 'Αρνί', 'Ρύζι', 'Ζεστή σοκολάτα'],
    pairs: ['Clove', 'Star anise', 'Cardamom', 'Vanilla'],
    pairsEl: ['Γαρύφαλλο', 'Αστεροειδής γλυκάνισος', 'Κάρδαμο', 'Βανίλια'],
    tip: 'Ceylon cinnamon is milder and sweeter; cassia (the common type) is stronger and spicier.',
    tipEl: 'Κανέλα Κεϋλάνης είναι πιο ήπια και γλυκιά· cassia (ο κοινός τύπος) είναι πιο δυνατός και πικάντικος.',
  },
  {
    name: 'Turmeric', nameEl: 'Κουρκουμάς', emoji: '🟡',
    flavor: 'Earthy, slightly bitter, peppery undertones', flavorEl: 'Γήινο, ελαφρώς πικρό, νότες πιπεριού',
    intensity: 1,
    uses: ['Curries', 'Rice', 'Soups', 'Marinades'],
    usesEl: ['Κάρι', 'Ρύζι', 'Σούπες', 'Μαρινάδες'],
    pairs: ['Black pepper', 'Ginger', 'Coconut', 'Cumin'],
    pairsEl: ['Μαύρο πιπέρι', 'Τζίντζερ', 'Καρύδα', 'Κύμινο'],
    tip: 'Pair with black pepper — piperine increases turmeric absorption by up to 2000%.',
    tipEl: 'Συνδυάστε με μαύρο πιπέρι — η πιπερίνη αυξάνει την απορρόφηση κουρκουμά κατά 2000%.',
  },
  {
    name: 'Coriander', nameEl: 'Κόλιανδρος', emoji: '🌿',
    flavor: 'Citrusy, floral, warm', flavorEl: 'Εσπεριδοειδές, ανθικό, ζεστό',
    intensity: 1,
    uses: ['Curries', 'Salsas', 'Marinades', 'Roasted vegetables'],
    usesEl: ['Κάρι', 'Σάλσες', 'Μαρινάδες', 'Ψητά λαχανικά'],
    pairs: ['Cumin', 'Chilli', 'Lime', 'Garlic'],
    pairsEl: ['Κύμινο', 'Τσίλι', 'Λάιμ', 'Σκόρδο'],
    tip: 'The seeds taste very different from the fresh herb — both are from the same plant.',
    tipEl: 'Οι σπόροι γεύονται πολύ διαφορετικά από το φρέσκο βότανο — και τα δύο είναι από το ίδιο φυτό.',
  },
  {
    name: 'Chilli Flakes', nameEl: 'Νιφάδες Τσίλι', emoji: '🌶️',
    flavor: 'Hot, fruity, smoky', flavorEl: 'Καυτερό, φρουτώδες, καπνιστό',
    intensity: 3,
    uses: ['Pasta aglio e olio', 'Pizza', 'Sautéed greens', 'Marinades'],
    usesEl: ['Παστα αλιό', 'Πίτσα', 'Σοταριστά χόρτα', 'Μαρινάδες'],
    pairs: ['Garlic', 'Olive oil', 'Lemon', 'Tomato'],
    pairsEl: ['Σκόρδο', 'Ελαιόλαδο', 'Λεμόνι', 'Ντομάτα'],
    tip: 'Add early in oil for deep heat; add at the end for brighter, spicier punch.',
    tipEl: 'Προσθέστε νωρίς στο λάδι για βαθύ καψάλισμα· στο τέλος για πιο ζωντανό τσίμπημα.',
  },
  {
    name: 'Star Anise', nameEl: 'Αστεροειδής Γλυκάνισος', emoji: '⭐',
    flavor: 'Sweet liquorice, warm, aromatic', flavorEl: 'Γλυκό γλυκάνισο, ζεστό, αρωματικό',
    intensity: 3,
    uses: ['Braised meats', 'Mulled wine', 'Pho', 'Broths'],
    usesEl: ['Μπρεζαρισμένα κρέατα', 'Ζεστό κρασί', 'Pho', 'Ζωμοί'],
    pairs: ['Cinnamon', 'Cloves', 'Ginger', 'Orange'],
    pairsEl: ['Κανέλα', 'Γαρύφαλλο', 'Τζίντζερ', 'Πορτοκάλι'],
    tip: 'Use sparingly — one pod is often enough for a whole braise.',
    tipEl: 'Χρησιμοποιήστε με φειδώ — ένα αστεράκι αρκεί συχνά για ολόκληρο μπρεζάρισμα.',
  },
  {
    name: 'Cardamom', nameEl: 'Κάρδαμο', emoji: '💚',
    flavor: 'Floral, citrusy, minty, complex', flavorEl: 'Ανθικό, εσπεριδοειδές, μεντολάτο, σύνθετο',
    intensity: 3,
    uses: ['Coffee', 'Rice pudding', 'Chai', 'Scandinavian pastries'],
    usesEl: ['Καφές', 'Ρυζόγαλο', 'Τσάι', 'Σκανδιναβικά γλυκά'],
    pairs: ['Cinnamon', 'Ginger', 'Vanilla', 'Coffee'],
    pairsEl: ['Κανέλα', 'Τζίντζερ', 'Βανίλια', 'Καφές'],
    tip: 'Crack the pod and use the seeds — the outer shell has little flavour.',
    tipEl: 'Σπάστε το κέλυφος και χρησιμοποιήστε τους σπόρους — το εξωτερικό κέλυφος έχει ελάχιστη γεύση.',
  },
  {
    name: 'Smoked Paprika', nameEl: 'Καπνιστή Πάπρικα', emoji: '💨',
    flavor: 'Deep smoky, sweet, complex', flavorEl: 'Βαθύ καπνιστό, γλυκό, σύνθετο',
    intensity: 2,
    uses: ['Patatas bravas', 'Chorizo', 'BBQ rubs', 'Roasted chickpeas'],
    usesEl: ['Πατάτες μπράβας', 'Τσόριθο', 'BBQ rubs', 'Ψητά ρεβίθια'],
    pairs: ['Cumin', 'Garlic', 'Tomato', 'Salt'],
    pairsEl: ['Κύμινο', 'Σκόρδο', 'Ντομάτα', 'Αλάτι'],
    tip: 'Can add smoke depth to vegetarian dishes where meat isn\'t used.',
    tipEl: 'Μπορεί να προσθέσει βάθος καπνού σε χορτοφαγικά πιάτα χωρίς κρέας.',
  },
  {
    name: 'Oregano', nameEl: 'Ρίγανη', emoji: '🌿',
    flavor: 'Herbal, slightly bitter, earthy, peppery', flavorEl: 'Βοτανικό, ελαφρώς πικρό, γήινο, πικάντικο',
    intensity: 2,
    uses: ['Pizza', 'Greek salad', 'Lamb', 'Tomato sauces'],
    usesEl: ['Πίτσα', 'Χωριάτικη σαλάτα', 'Αρνί', 'Σάλτσες τομάτας'],
    pairs: ['Tomato', 'Lemon', 'Olive oil', 'Garlic'],
    pairsEl: ['Ντομάτα', 'Λεμόνι', 'Ελαιόλαδο', 'Σκόρδο'],
    tip: 'Greek oregano is more intense than Italian — use half the amount when substituting.',
    tipEl: 'Η ελληνική ρίγανη είναι πιο έντονη από την ιταλική — χρησιμοποιήστε τη μισή ποσότητα.',
  },
  {
    name: 'Thyme', nameEl: 'Θυμάρι', emoji: '🌱',
    flavor: 'Earthy, minty, slightly lemony', flavorEl: 'Γήινο, μεντολάτο, ελαφρώς λεμονάτο',
    intensity: 1,
    uses: ['Roast chicken', 'Stocks', 'Soups', 'Legumes'],
    usesEl: ['Κοτόπουλο ψητό', 'Ζωμοί', 'Σούπες', 'Όσπρια'],
    pairs: ['Rosemary', 'Bay leaf', 'Garlic', 'Lemon'],
    pairsEl: ['Δεντρολίβανο', 'Δάφνη', 'Σκόρδο', 'Λεμόνι'],
    tip: 'Add early when cooking — its flavour develops over long heat unlike delicate herbs.',
    tipEl: 'Προσθέστε νωρίς στο μαγείρεμα — η γεύση του αναπτύσσεται με τη μακρά θέρμανση.',
  },
  {
    name: 'Rosemary', nameEl: 'Δεντρολίβανο', emoji: '🪴',
    flavor: 'Piney, pungent, resinous, camphor notes', flavorEl: 'Κωνιφερώδες, έντονο, ρητινώδες, νότες καμφοράς',
    intensity: 3,
    uses: ['Lamb', 'Potatoes', 'Focaccia', 'Infused oils'],
    usesEl: ['Αρνί', 'Πατάτες', 'Φοκάτσια', 'Αρωματισμένα λάδια'],
    pairs: ['Garlic', 'Lemon', 'Olive oil', 'Thyme'],
    pairsEl: ['Σκόρδο', 'Λεμόνι', 'Ελαιόλαδο', 'Θυμάρι'],
    tip: 'Very potent — a little goes a long way. Remove sprigs before serving.',
    tipEl: 'Πολύ δυνατό — λίγο αρκεί. Αφαιρέστε τα κλαδιά πριν σερβίρετε.',
  },
  {
    name: 'Saffron', nameEl: 'Σαφράν / Κρόκος', emoji: '🟠',
    flavor: 'Floral, honey-like, slightly metallic', flavorEl: 'Ανθικό, μελωδικό, ελαφρώς μεταλλικό',
    intensity: 2,
    uses: ['Paella', 'Risotto Milanese', 'Bouillabaisse', 'Persian rice'],
    usesEl: ['Παέγια', 'Ριζότο Μιλανέζε', 'Μπουγιαμπές', 'Περσικό ρύζι'],
    pairs: ['Tomato', 'Fish', 'Cream', 'Lemon'],
    pairsEl: ['Ντομάτα', 'Ψάρι', 'Κρέμα γάλακτος', 'Λεμόνι'],
    tip: 'Steep threads in warm water or stock for 15 minutes first to extract maximum colour and flavour.',
    tipEl: 'Μουλιάστε σε ζεστό νερό ή ζωμό 15 λεπτά πριν χρησιμοποιήσετε για μέγιστο χρώμα και άρωμα.',
  },
]

const INTENSITY_LABEL = ['', 'Ήπιο', 'Μέτριο', 'Έντονο']
const INTENSITY_COLOR = ['', 'text-emerald-400', 'text-amber-400', 'text-red-400']

function NoteEditor({ spiceName }: { spiceName: string }) {
  const { note, setNote, saving, save, isDirty } = useLibraryNote('spice', spiceName)
  return (
    <div className="border-t border-white/8 pt-3 mt-2 space-y-1.5">
      <p className="text-[10px] text-white/30 uppercase tracking-wider">Προσωπικές σημειώσεις</p>
      <textarea
        rows={2}
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Προσθέστε σημειώσεις, tips ή εμπειρίες σας…"
        className="w-full bg-white/4 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 placeholder:text-white/20 outline-none focus:ring-1 focus:ring-brand-orange/40 resize-none"
      />
      {isDirty && (
        <button type="button" onClick={() => save(note)} disabled={saving}
          className="text-[11px] text-brand-orange hover:opacity-80 transition disabled:opacity-40">
          {saving ? 'Αποθήκευση…' : 'Αποθήκευση'}
        </button>
      )}
    </div>
  )
}

function SpiceCard({ spice, isEl }: { spice: Spice; isEl: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <GlassCard className="!p-0 overflow-hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} className="w-full text-left px-4 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl shrink-0">{spice.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-white">{isEl ? spice.nameEl : spice.name}</p>
            {isEl && <p className="text-[11px] text-white/35">{spice.name}</p>}
          </div>
          <span className={cn('text-[11px] font-medium shrink-0', INTENSITY_COLOR[spice.intensity])}>
            {'● '.repeat(spice.intensity).trim()}
          </span>
        </div>
        <p className="text-xs text-white/45 mt-2 line-clamp-1">
          {isEl ? spice.flavorEl : spice.flavor}
        </p>
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-white/6 pt-3 space-y-3">
          <div>
            <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Γεύση</p>
            <p className="text-sm text-white/70">{isEl ? spice.flavorEl : spice.flavor}</p>
            <p className="text-[11px] text-white/35 mt-0.5">{INTENSITY_LABEL[spice.intensity]}</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Χρήσεις</p>
              <ul className="space-y-0.5">
                {(isEl ? spice.usesEl : spice.uses).map((u) => (
                  <li key={u} className="text-xs text-white/60 flex gap-1.5">
                    <span className="text-brand-orange shrink-0">›</span>{u}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider mb-1">Συνδυασμοί</p>
              <ul className="space-y-0.5">
                {(isEl ? spice.pairsEl : spice.pairs).map((p) => (
                  <li key={p} className="text-xs text-white/60 flex gap-1.5">
                    <span className="text-white/20 shrink-0">+</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {(isEl ? spice.tipEl : spice.tip) && (
            <div className="rounded-lg bg-brand-orange/8 border border-brand-orange/20 px-3 py-2">
              <p className="text-xs text-white/60 italic">
                {isEl ? spice.tipEl : spice.tip}
              </p>
            </div>
          )}
          <NoteEditor spiceName={spice.name} />
        </div>
      )}
    </GlassCard>
  )
}

export default function SpiceGuide() {
  const { i18n } = useTranslation()
  const isEl = i18n.language.startsWith('el')
  const [search, setSearch] = useState('')

  const filtered = SPICES.filter((s) => {
    const q = search.toLowerCase()
    return !q || s.name.toLowerCase().includes(q) || s.nameEl.toLowerCase().includes(q)
      || s.flavor.toLowerCase().includes(q) || s.flavorEl.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-400/15">
          <Flame className="h-5 w-5 text-amber-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Οδηγός Μπαχαρικών</h1>
          <p className="text-sm text-white/40 mt-0.5">Γεύσεις, χρήσεις & συνδυασμοί για {SPICES.length} βασικά μπαχαρικά</p>
        </div>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <input type="text" placeholder="Αναζήτηση μπαχαρικών…" value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="glass rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-white/25 outline-none focus:ring-1 focus:ring-brand-orange/50 max-w-sm w-full" />
        <div className="flex gap-2 text-xs text-white/35">
          {[1, 2, 3].map((i) => (
            <span key={i} className={INTENSITY_COLOR[i as 1 | 2 | 3]}>
              {'●'.repeat(i)} {INTENSITY_LABEL[i]}
            </span>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="text-center text-sm text-white/30 py-16">Δεν βρέθηκαν μπαχαρικά</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((spice) => (
            <SpiceCard key={spice.name} spice={spice} isEl={isEl} />
          ))}
        </div>
      )}
    </div>
  )
}
