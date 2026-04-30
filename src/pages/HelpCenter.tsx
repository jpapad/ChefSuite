import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink } from 'react-router-dom'
import {
  CheckCircle2, Circle, ChevronDown, ChevronUp, ExternalLink,
  LayoutDashboard, ChefHat, UtensilsCrossed, ClipboardList, Monitor,
  Thermometer, Package, Truck, ClipboardCheck, Trash2, LineChart,
  Users, CalendarDays, TimerIcon, Award, Star, CalendarCheck,
  TrendingUp, BarChart3, MessageSquare, Radio, BookOpen, Heart,
  Bot, Scale, BookMarked, Layers, Keyboard, HelpCircle, Sparkles,
  type LucideIcon,
} from 'lucide-react'
import { GlassCard } from '../components/ui/GlassCard'
import { cn } from '../lib/cn'

// ── Onboarding checklist ─────────────────────────────────────
const STORAGE_KEY = 'chefsuite_onboarding_v1'

interface Step {
  id: string; path: string; icon: LucideIcon
  label: string; labelEl: string
}

const STEPS: Step[] = [
  { id: 'recipe',    path: '/recipes',       icon: ChefHat,       label: 'Create your first recipe',             labelEl: 'Δημιουργήστε την πρώτη σας συνταγή' },
  { id: 'inventory', path: '/inventory',     icon: Package,       label: 'Add your first inventory item',         labelEl: 'Προσθέστε το πρώτο σας αποθεματικό' },
  { id: 'menu',      path: '/menus',         icon: UtensilsCrossed, label: 'Build a menu',                       labelEl: 'Φτιάξτε ένα μενού' },
  { id: 'team',      path: '/team',          icon: Users,         label: 'Invite a team member',                  labelEl: 'Προσκαλέστε μέλος ομάδας' },
  { id: 'prep',      path: '/prep',          icon: ClipboardList, label: 'Complete a prep task',                  labelEl: 'Ολοκληρώστε μια εργασία προετοιμασίας' },
  { id: 'haccp',     path: '/haccp',         icon: Thermometer,   label: 'Log a HACCP temperature check',         labelEl: 'Καταγράψτε έλεγχο θερμοκρασίας HACCP' },
  { id: 'copilot',   path: '/copilot',       icon: Bot,           label: 'Ask the Chef Copilot a question',       labelEl: 'Ρωτήστε τον Chef Copilot' },
  { id: 'report',    path: '/analytics',     icon: TrendingUp,    label: 'Send an email report',                  labelEl: 'Στείλτε αναφορά email' },
  { id: 'library',   path: '/culinary-tools',icon: Scale,         label: 'Explore the culinary library',          labelEl: 'Εξερευνήστε τη βιβλιοθήκη μαγειρικής' },
]

// ── Feature cards ────────────────────────────────────────────
interface FeatureCard {
  path: string; icon: LucideIcon
  name: string; nameEl: string
  description: string; descriptionEl: string
  bullets: string[]; bulletsEl: string[]
}

interface FeatureGroup {
  id: string; labelKey: string
  cards: FeatureCard[]
}

const FEATURE_GROUPS: FeatureGroup[] = [
  {
    id: 'kitchen', labelKey: 'nav.groups.kitchen',
    cards: [
      {
        path: '/', icon: LayoutDashboard,
        name: 'Dashboard', nameEl: 'Πίνακας Ελέγχου',
        description: 'Your kitchen at a glance — prep status, low-stock alerts, recent activity, and key KPIs.',
        descriptionEl: 'Η κουζίνα σας με μια ματιά — κατάσταση prep, ειδοποιήσεις stock, πρόσφατη δραστηριότητα και KPIs.',
        bullets: ['Real-time prep completion rate', 'Low stock & expiry alerts', 'Daily sales & covers summary'],
        bulletsEl: ['Ποσοστό ολοκλήρωσης prep σε πραγματικό χρόνο', 'Ειδοποιήσεις χαμηλού stock & λήξης', 'Ημερήσια σύνοψη πωλήσεων'],
      },
      {
        path: '/recipes', icon: ChefHat,
        name: 'Recipes', nameEl: 'Συνταγές',
        description: 'Full recipe library with cost analysis, allergens, nutrition, version history, AI import, variations, and team comments.',
        descriptionEl: 'Πλήρης βιβλιοθήκη συνταγών με ανάλυση κόστους, αλλεργιογόνα, θρεπτικά, ιστορικό, AI εισαγωγή, παραλλαγές και σχόλια.',
        bullets: ['Automatic food cost per portion', 'AI recipe import from text or description', 'Nutrition estimation via Gemini AI', 'Version history with diff view', 'Recipe variations (e.g. vegan/GF versions)', 'Team comments per recipe'],
        bulletsEl: ['Αυτόματο κόστος φαγητού ανά μερίδα', 'AI εισαγωγή συνταγής από κείμενο ή περιγραφή', 'Εκτίμηση θρεπτικών μέσω Gemini AI', 'Ιστορικό εκδόσεων με diff view', 'Παραλλαγές συνταγής (π.χ. vegan/χωρίς γλουτένη)', 'Σχόλια ομάδας ανά συνταγή'],
      },
      {
        path: '/menus', icon: UtensilsCrossed,
        name: 'Menus', nameEl: 'Μενού',
        description: 'Build multi-section menus linked to recipes. Generate QR-code menu pages, print buffet labels, and track food cost per menu.',
        descriptionEl: 'Φτιάξτε μενού με πολλαπλές ενότητες συνδεδεμένες με συνταγές. QR-code σελίδα, εκτύπωση ετικετών και κόστος φαγητού.',
        bullets: ['Drag-and-drop item ordering', 'Shareable public QR-code menu page', 'Print buffet labels (EN/EL, custom size)', 'Food cost % per menu'],
        bulletsEl: ['Αναδιάταξη items με drag-and-drop', 'Κοινόχρηστη σελίδα μενού με QR code', 'Εκτύπωση ετικετών μπουφέ (EN/EL, custom μέγεθος)', 'Ποσοστό κόστους φαγητού ανά μενού'],
      },
      {
        path: '/prep', icon: ClipboardList,
        name: 'Prep Tasks', nameEl: 'Εργασίες Prep',
        description: 'Daily prep checklists with task templates, step-by-step instructions, and completion tracking.',
        descriptionEl: 'Ημερήσιες λίστες prep με πρότυπα εργασιών, οδηγίες βήμα-βήμα και παρακολούθηση ολοκλήρωσης.',
        bullets: ['Reusable task templates', 'Step-by-step sub-tasks', 'Assign tasks to team members', 'Link prep tasks to menu items'],
        bulletsEl: ['Επαναχρησιμοποιήσιμα πρότυπα εργασιών', 'Υπο-εργασίες βήμα-βήμα', 'Ανάθεση εργασιών σε μέλη ομάδας', 'Σύνδεση prep tasks με items μενού'],
      },
      {
        path: '/kds', icon: Monitor,
        name: 'Kitchen Display (KDS)', nameEl: 'Οθόνη Κουζίνας (KDS)',
        description: 'Real-time order display organised by workstation. Bump orders as they are completed.',
        descriptionEl: 'Προβολή παραγγελιών σε πραγματικό χρόνο ανά σταθμό εργασίας. Ολοκλήρωση παραγγελιών με ένα κλικ.',
        bullets: ['Per-workstation order queues', 'Live updates via Supabase Realtime', 'Order age timer (colour-coded urgency)'],
        bulletsEl: ['Ουρές παραγγελιών ανά σταθμό', 'Ζωντανές ενημερώσεις μέσω Supabase Realtime', 'Χρονόμετρο ηλικίας παραγγελίας (χρωματιστό)'],
      },
      {
        path: '/haccp', icon: Thermometer,
        name: 'HACCP Log', nameEl: 'Αρχείο HACCP',
        description: 'Log temperature checks, corrective actions, and compliance records. Set recurring reminders for your team.',
        descriptionEl: 'Καταγραφή ελέγχων θερμοκρασίας, διορθωτικών ενεργειών και αρχείων συμμόρφωσης. Επαναλαμβανόμενες υπενθυμίσεις για την ομάδα.',
        bullets: ['Timestamped temperature logs', 'Corrective action notes', 'Scheduled reminders (every 1–24 h)', 'Overdue badge with count'],
        bulletsEl: ['Καταγραφές θερμοκρασίας με χρονική σήμανση', 'Σημειώσεις διορθωτικών ενεργειών', 'Προγραμματισμένες υπενθυμίσεις (ανά 1–24 ώρ)', 'Badge με αριθμό εκπρόθεσμων'],
      },
    ],
  },
  {
    id: 'procurement', labelKey: 'nav.groups.procurement',
    cards: [
      {
        path: '/inventory', icon: Package,
        name: 'Inventory', nameEl: 'Αποθεματικό',
        description: 'Multi-location stock tracking with unit precision, movement history, and days-until-depletion forecast.',
        descriptionEl: 'Παρακολούθηση stock σε πολλαπλές τοποθεσίες, ιστορικό κινήσεων και πρόβλεψη ημερών μέχρι εξάντληση.',
        bullets: ['IN / OUT movement log with reason codes', 'Low-stock threshold alerts', 'Inventory forecast (last 30-day usage rate)', 'QR-code scanning for mobile updates'],
        bulletsEl: ['Αρχείο κινήσεων ΕΙΣ/ΕΞΟ με κωδικούς αιτίας', 'Ειδοποιήσεις ορίου χαμηλού stock', 'Πρόβλεψη αποθέματος (χρήση 30 ημερών)', 'Σάρωση QR code για ενημέρωση από κινητό'],
      },
      {
        path: '/suppliers', icon: Truck,
        name: 'Suppliers', nameEl: 'Προμηθευτές',
        description: 'Supplier directory with contact details, logos, and direct links to purchase orders.',
        descriptionEl: 'Κατάλογος προμηθευτών με στοιχεία επικοινωνίας, λογότυπα και άμεση σύνδεση με παραγγελίες αγοράς.',
        bullets: ['Add unlimited suppliers', 'Store contact info and notes', 'Quick-access to supplier POs'],
        bulletsEl: ['Απεριόριστοι προμηθευτές', 'Αποθήκευση στοιχείων επικοινωνίας', 'Γρήγορη πρόσβαση στις παραγγελίες ανά προμηθευτή'],
      },
      {
        path: '/orders', icon: ClipboardCheck,
        name: 'Purchase Orders', nameEl: 'Παραγγελίες Αγοράς',
        description: 'Create and track purchase orders per supplier with status tracking and delivery confirmation.',
        descriptionEl: 'Δημιουργία και παρακολούθηση παραγγελιών αγοράς ανά προμηθευτή με κατάσταση και επιβεβαίωση παράδοσης.',
        bullets: ['Draft → Sent → Delivered workflow', 'Line items with quantities and prices', 'Full PO history per supplier'],
        bulletsEl: ['Ροή εργασίας Πρόχειρο → Απεστάλη → Παραδόθηκε', 'Γραμμές με ποσότητες και τιμές', 'Πλήρες ιστορικό PO ανά προμηθευτή'],
      },
      {
        path: '/waste', icon: Trash2,
        name: 'Waste Log', nameEl: 'Αρχείο Αποβλήτων',
        description: 'Record food waste by item, quantity, and reason. View cost reports to identify your biggest waste sources.',
        descriptionEl: 'Καταγραφή σπατάλης τροφίμων ανά είδος, ποσότητα και αιτία. Αναφορές κόστους για εντοπισμό κύριων πηγών σπατάλης.',
        bullets: ['Log waste with reason codes', 'Cost per waste entry (linked to inventory prices)', 'Weekly / monthly waste cost summaries'],
        bulletsEl: ['Καταγραφή σπατάλης με κωδικούς αιτίας', 'Κόστος ανά καταχώρηση (συνδεδεμένο με τιμές stock)', 'Εβδομαδιαίες / μηνιαίες συνοψίσεις κόστους σπατάλης'],
      },
      {
        path: '/price-tracking', icon: LineChart,
        name: 'Price Tracker', nameEl: 'Παρακολούθηση Τιμών',
        description: 'Track ingredient price changes over time per supplier — catch price creep before it impacts your margins.',
        descriptionEl: 'Παρακολούθηση αλλαγών τιμής υλικών ανά προμηθευτή — εντοπίστε σταδιακές αυξήσεις πριν επηρεάσουν τα περιθώρια.',
        bullets: ['Price history charts per ingredient', 'Compare prices across suppliers', 'Flag significant price changes'],
        bulletsEl: ['Γραφήματα ιστορικού τιμής ανά υλικό', 'Σύγκριση τιμών μεταξύ προμηθευτών', 'Επισήμανση σημαντικών αλλαγών τιμής'],
      },
    ],
  },
  {
    id: 'team', labelKey: 'nav.groups.team',
    cards: [
      {
        path: '/team', icon: Users,
        name: 'Team', nameEl: 'Ομάδα',
        description: 'Invite members, assign roles (Owner / Manager / Staff), and set granular per-module permissions.',
        descriptionEl: 'Προσκαλέστε μέλη, ορίστε ρόλους (Ιδιοκτήτης / Διαχειριστής / Προσωπικό) και ρυθμίστε λεπτομερή δικαιώματα ανά module.',
        bullets: ['Email invitations', 'Role-based access (owner always has full access)', 'Toggle any module per member'],
        bulletsEl: ['Προσκλήσεις μέσω email', 'Πρόσβαση βάσει ρόλου (ο ιδιοκτήτης έχει πάντα πλήρη πρόσβαση)', 'Εναλλαγή οποιουδήποτε module ανά μέλος'],
      },
      {
        path: '/shifts', icon: CalendarDays,
        name: 'Shifts', nameEl: 'Βάρδιες',
        description: 'Weekly calendar scheduling with per-member colour coding. Print or export the A4 schedule.',
        descriptionEl: 'Εβδομαδιαίο ημερολόγιο προγραμματισμού με χρωματική κωδικοποίηση ανά μέλος. Εκτύπωση ή εξαγωγή σε A4.',
        bullets: ['Drag-and-drop shift placement', 'Per-member colour coding', 'Printable A4 weekly schedule'],
        bulletsEl: ['Τοποθέτηση βάρδιας με drag-and-drop', 'Χρωματική κωδικοποίηση ανά μέλος', 'Εκτυπώσιμο εβδομαδιαίο πρόγραμμα A4'],
      },
      {
        path: '/timeclock', icon: TimerIcon,
        name: 'Timeclock', nameEl: 'Ρολόι Παρουσίας',
        description: 'Digital punch-in / punch-out for all staff. View daily summaries and total hours worked.',
        descriptionEl: 'Ψηφιακή είσοδος / έξοδος για όλο το προσωπικό. Ημερήσιες συνοψίσεις και σύνολο ωρών εργασίας.',
        bullets: ['One-tap punch in/out', 'Daily and weekly hour summaries', 'Staff-level time reports'],
        bulletsEl: ['Είσοδος/έξοδος με ένα κλικ', 'Ημερήσιες και εβδομαδιαίες συνοψίσεις ωρών', 'Αναφορές ωρών ανά μέλος'],
      },
      {
        path: '/staff-performance', icon: Award,
        name: 'Staff Performance', nameEl: 'Απόδοση Προσωπικού',
        description: 'Hours worked and prep task completion rate per team member over any selected time range.',
        descriptionEl: 'Ώρες εργασίας και ποσοστό ολοκλήρωσης prep tasks ανά μέλος ομάδας για οποιαδήποτε χρονική περίοδο.',
        bullets: ['Hours vs target comparison', 'Task completion rate', 'Sortable by member or period'],
        bulletsEl: ['Σύγκριση ωρών με στόχο', 'Ποσοστό ολοκλήρωσης εργασιών', 'Ταξινόμηση ανά μέλος ή περίοδο'],
      },
    ],
  },
  {
    id: 'revenue', labelKey: 'nav.groups.revenue',
    cards: [
      {
        path: '/menu-engineering', icon: Star,
        name: 'Menu Engineering', nameEl: 'Μηχανική Μενού',
        description: 'Classify menu items into the classic Star / Plow Horse / Puzzle / Dog quadrants based on popularity and profitability.',
        descriptionEl: 'Κατατάξτε items μενού στα κλασικά τεταρτημόρια Αστέρι / Αργό / Γρίφος / Σκυλί βάσει δημοτικότητας και κερδοφορίας.',
        bullets: ['Automatic quadrant placement', 'Visual matrix chart', 'Action recommendations per category'],
        bulletsEl: ['Αυτόματη τοποθέτηση σε τεταρτημόριο', 'Οπτικός χάρτης μήτρας', 'Προτάσεις ενεργειών ανά κατηγορία'],
      },
      {
        path: '/reservations', icon: CalendarCheck,
        name: 'Reservations', nameEl: 'Κρατήσεις',
        description: 'Table booking management with a built-in public booking page your guests can access directly.',
        descriptionEl: 'Διαχείριση κρατήσεων τραπεζιών με ενσωματωμένη δημόσια σελίδα κράτησης για τους πελάτες σας.',
        bullets: ['Built-in public booking page (no login required)', 'Table and cover management', 'Date / time / party size tracking'],
        bulletsEl: ['Δημόσια σελίδα κράτησης (χωρίς σύνδεση)', 'Διαχείριση τραπεζιών και καλυμμάτων', 'Παρακολούθηση ημερομηνίας / ώρας / μεγέθους ομάδας'],
      },
      {
        path: '/analytics', icon: TrendingUp,
        name: 'Analytics', nameEl: 'Αναλυτικά',
        description: 'Sales, covers, food cost %, prep completion, and inventory forecast. Send weekly HTML email reports to stakeholders.',
        descriptionEl: 'Πωλήσεις, καλύμματα, % κόστους φαγητού, ολοκλήρωση prep και πρόβλεψη stock. Εβδομαδιαίες αναφορές HTML μέσω email.',
        bullets: ['7-day sales & covers chart', 'Food cost % trend', 'Inventory forecast per item', 'One-click email report to any recipients'],
        bulletsEl: ['Γράφημα πωλήσεων & καλυμμάτων 7 ημερών', 'Τάση % κόστους φαγητού', 'Πρόβλεψη stock ανά είδος', 'Αναφορά email με ένα κλικ σε οποιεσδήποτε διευθύνσεις'],
      },
      {
        path: '/pl', icon: BarChart3,
        name: 'Profit & Loss', nameEl: 'Αποτελέσματα Χρήσης',
        description: 'P&L overview combining food cost, waste cost, labour estimates, and revenue figures.',
        descriptionEl: 'Επισκόπηση αποτελεσμάτων χρήσης με κόστος φαγητού, σπατάλης, εκτίμηση εργασίας και έσοδα.',
        bullets: ['Monthly and weekly breakdown', 'Food cost vs waste cost vs revenue', 'Gross margin calculation'],
        bulletsEl: ['Μηνιαία και εβδομαδιαία ανάλυση', 'Κόστος φαγητού vs σπατάλης vs έσοδα', 'Υπολογισμός μικτού περιθωρίου'],
      },
    ],
  },
  {
    id: 'comms', labelKey: 'nav.groups.comms',
    cards: [
      {
        path: '/chat', icon: MessageSquare,
        name: 'Team Chat', nameEl: 'Ομαδική Συνομιλία',
        description: 'Persistent in-app messaging for your team — keep all kitchen communication in one searchable place.',
        descriptionEl: 'Μόνιμη ενδο-εφαρμογή ανταλλαγή μηνυμάτων — διατηρήστε όλη την επικοινωνία κουζίνας σε ένα μέρος.',
        bullets: ['Real-time via Supabase Realtime', 'Message history persisted', 'All team members in one thread'],
        bulletsEl: ['Πραγματικός χρόνος μέσω Supabase Realtime', 'Μόνιμο ιστορικό μηνυμάτων', 'Όλα τα μέλη σε ένα κανάλι'],
      },
      {
        path: '/walkie', icon: Radio,
        name: 'Walkie-Talkie', nameEl: 'Ασύρματος',
        description: 'Real-time push-to-talk voice messaging between staff — no phone numbers or external apps needed.',
        descriptionEl: 'Φωνητικά μηνύματα push-to-talk σε πραγματικό χρόνο — χωρίς τηλέφωνα ή εξωτερικές εφαρμογές.',
        bullets: ['Hold to record, release to send', 'All connected team members receive instantly', 'Works on mobile and desktop'],
        bulletsEl: ['Κρατήστε για εγγραφή, αφήστε για αποστολή', 'Άμεση λήψη από όλα τα συνδεδεμένα μέλη', 'Λειτουργεί σε κινητό και υπολογιστή'],
      },
      {
        path: '/journal', icon: BookOpen,
        name: "Chef's Journal", nameEl: 'Ημερολόγιο Chef',
        description: 'Personal chef diary for notes, observations, ideas, and reflections — private to each user.',
        descriptionEl: 'Προσωπικό ημερολόγιο chef για σημειώσεις, παρατηρήσεις και ιδέες — ιδιωτικό για κάθε χρήστη.',
        bullets: ['Rich text entries', 'Date-based organisation', 'Fully private — not visible to other team members'],
        bulletsEl: ['Καταχωρήσεις με μορφοποιημένο κείμενο', 'Οργάνωση βάσει ημερομηνίας', 'Πλήρως ιδιωτικό — δεν φαίνεται σε άλλα μέλη'],
      },
      {
        path: '/pulse', icon: Heart,
        name: 'Kitchen Pulse', nameEl: 'Σφυγμός Κουζίνας',
        description: 'Live status board showing the current state of all active kitchen workstations in real time.',
        descriptionEl: 'Ζωντανός πίνακας κατάστασης που δείχνει την τρέχουσα κατάσταση όλων των ενεργών σταθμών κουζίνας.',
        bullets: ['Per-workstation status indicators', 'Real-time updates', 'At-a-glance kitchen overview'],
        bulletsEl: ['Δείκτες κατάστασης ανά σταθμό', 'Ενημερώσεις σε πραγματικό χρόνο', 'Γρήγορη επισκόπηση κουζίνας'],
      },
      {
        path: '/copilot', icon: Bot,
        name: 'Chef Copilot', nameEl: 'Chef Copilot',
        description: 'AI assistant with full context of your kitchen data — ask about food cost, recipe ideas, substitutions, or anything culinary.',
        descriptionEl: 'AI βοηθός με πλήρη πρόσβαση στα δεδομένα κουζίνας σας — ρωτήστε για κόστος, ιδέες συνταγών ή οτιδήποτε μαγειρικό.',
        bullets: ['Aware of your recipes, inventory, and waste data', 'Answers in Greek or English', 'Requires VITE_GEMINI_API_KEY in .env.local'],
        bulletsEl: ['Γνωρίζει τις συνταγές, το stock και τη σπατάλη σας', 'Απαντά στα ελληνικά ή αγγλικά', 'Απαιτεί VITE_GEMINI_API_KEY στο .env.local'],
      },
    ],
  },
  {
    id: 'library', labelKey: 'nav.groups.library',
    cards: [
      {
        path: '/culinary-tools', icon: Scale,
        name: 'Kitchen Tools', nameEl: 'Εργαλεία Κουζίνας',
        description: 'Unit converter, recipe scaling calculator, ingredient substitution guide, and temperature reference tables.',
        descriptionEl: 'Μετατροπέας μονάδων, υπολογιστής κλιμάκωσης συνταγής, οδηγός αντικατάστασης υλικών και πίνακες θερμοκρασίας.',
        bullets: ['Weight, volume, and temperature conversion', 'Scale any recipe to any yield instantly', '11 ingredient substitution categories', 'Meat temps, oven guide, oil smoke points'],
        bulletsEl: ['Μετατροπή βάρους, όγκου και θερμοκρασίας', 'Κλιμάκωση οποιασδήποτε συνταγής αμέσως', '11 κατηγορίες αντικατάστασης υλικών', 'Θερμοκρασίες κρεάτων, οδηγός φούρνου, σημεία καύσης λαδιών'],
      },
      {
        path: '/glossary', icon: BookMarked,
        name: 'Culinary Glossary', nameEl: 'Γλωσσάρι Μαγειρικής',
        description: '63+ professional culinary terms with full definitions and Greek translations — searchable by keyword or category.',
        descriptionEl: '63+ επαγγελματικοί μαγειρικοί όροι με πλήρεις ορισμούς και ελληνικές μεταφράσεις — αναζήτηση ανά λέξη-κλειδί ή κατηγορία.',
        bullets: ['6 categories: Techniques, French, Sauces, Italian, Baking, Equipment', 'Greek name + English definition', 'Instantly searchable'],
        bulletsEl: ['6 κατηγορίες: Τεχνικές, Γαλλικοί, Σάλτσες, Ιταλικοί, Ζαχαροπλαστική, Εξοπλισμός', 'Ελληνική ονομασία + αγγλικός ορισμός', 'Άμεση αναζήτηση'],
      },
      {
        path: '/techniques', icon: Layers,
        name: 'Technique Library', nameEl: 'Βιβλιοθήκη Τεχνικών',
        description: '21 professional kitchen techniques with descriptions, difficulty levels, time estimates, and actionable tips.',
        descriptionEl: '21 επαγγελματικές τεχνικές κουζίνας με περιγραφές, επίπεδα δυσκολίας, εκτιμήσεις χρόνου και πρακτικές συμβουλές.',
        bullets: ['5 categories: Knife Skills, Heat Methods, Sauces, Baking, Prep', 'Beginner / Intermediate / Advanced filter', 'Expandable cards with practical tips'],
        bulletsEl: ['5 κατηγορίες: Μαχαίρι, Θερμότητα, Σάλτσες, Ζαχαροπλαστική, Προετοιμασία', 'Φίλτρο Αρχάριος / Μέσος / Προχωρημένος', 'Επεκτάσιμες κάρτες με πρακτικές συμβουλές'],
      },
    ],
  },
]

// ── FAQ ──────────────────────────────────────────────────────
interface FAQItem {
  q: string; qEl: string; a: string; aEl: string
}

const FAQ: FAQItem[] = [
  {
    q: 'How does food cost calculation work?',
    qEl: 'Πώς λειτουργεί ο υπολογισμός κόστους φαγητού;',
    a: 'Food cost is calculated per recipe by summing the cost of each ingredient (price × quantity used) divided by the number of portions. Ingredient prices come from your inventory. The food cost % is the cost per portion divided by the selling price. Make sure your inventory items have current prices set for accurate results.',
    aEl: 'Το κόστος φαγητού υπολογίζεται ανά συνταγή αθροίζοντας το κόστος κάθε υλικού (τιμή × ποσότητα που χρησιμοποιείται) διαιρεμένο με τον αριθμό μερίδων. Οι τιμές υλικών προέρχονται από το αποθεματικό σας. Βεβαιωθείτε ότι τα αποθεματικά σας έχουν ενημερωμένες τιμές για ακριβή αποτελέσματα.',
  },
  {
    q: 'Which features require a Gemini API key?',
    qEl: 'Ποιες λειτουργίες χρειάζονται Gemini API key;',
    a: 'Three features require a VITE_GEMINI_API_KEY in your .env.local file: (1) AI Recipe Import — paste text or describe a dish to auto-structure it as a recipe, (2) Nutrition Estimation — analyse a recipe\'s macros from its ingredients, (3) Chef Copilot — the conversational AI kitchen assistant. All other features work without it.',
    aEl: 'Τρεις λειτουργίες χρειάζονται VITE_GEMINI_API_KEY στο αρχείο .env.local σας: (1) AI Εισαγωγή Συνταγής — επικολλήστε κείμενο ή περιγράψτε πιάτο για αυτόματη δομή, (2) Εκτίμηση Θρεπτικών — ανάλυση μακροθρεπτικών συνταγής από τα υλικά, (3) Chef Copilot — ο AI βοηθός κουζίνας. Όλες οι άλλες λειτουργίες δουλεύουν χωρίς αυτό.',
  },
  {
    q: 'How do I set up automated email reports?',
    qEl: 'Πώς ρυθμίζω αυτόματες αναφορές email;',
    a: 'Go to Analytics → click "Email Report" in the top right. Add recipient addresses and click "Send Now" to test. For automatic weekly delivery every Monday, set up a pg_cron job in your Supabase dashboard (see README for the SQL). A Resend API key must be set as a Supabase secret: RESEND_API_KEY.',
    aEl: 'Πηγαίνετε στα Αναλυτικά → κλικ "Αναφορά Email" πάνω δεξιά. Προσθέστε διευθύνσεις παραληπτών και κλικ "Αποστολή Τώρα" για δοκιμή. Για αυτόματη εβδομαδιαία παράδοση κάθε Δευτέρα, ρυθμίστε pg_cron στο Supabase dashboard (βλέπε README). Απαιτείται Resend API key ως Supabase secret: RESEND_API_KEY.',
  },
  {
    q: 'How do I invite team members?',
    qEl: 'Πώς προσκαλώ μέλη ομάδας;',
    a: 'Go to Team → click "Invite Member". Enter their email, assign a role (Manager or Staff), and configure which modules they can access. They\'ll receive an email invitation. You can adjust their permissions at any time from the Team page. The owner role always has full access and cannot be restricted.',
    aEl: 'Πηγαίνετε στην Ομάδα → κλικ "Πρόσκληση Μέλους". Εισάγετε το email τους, ορίστε ρόλο (Διαχειριστής ή Προσωπικό) και ρυθμίστε ποια modules μπορούν να δουν. Θα λάβουν πρόσκληση μέσω email. Μπορείτε να αλλάξετε δικαιώματα ανά πάσα στιγμή. Ο ρόλος ιδιοκτήτη έχει πάντα πλήρη πρόσβαση.',
  },
  {
    q: 'How does the inventory forecast work?',
    qEl: 'Πώς λειτουργεί η πρόβλεψη αποθέματος;',
    a: 'The forecast calculates average daily usage from the last 30 days of inventory movements (OUT type) per item. It then divides current stock by that daily rate to estimate days-until-depletion. Items in red have fewer than 3 days remaining; amber means under 7 days. Items with no recent movements show as grey (no data).',
    aEl: 'Η πρόβλεψη υπολογίζει μέση ημερήσια χρήση από τις κινήσεις αποθέματος (τύπος ΕΞΟΔΟΣ) των τελευταίων 30 ημερών ανά είδος. Διαιρεί το τρέχον stock με αυτό το ρυθμό για εκτίμηση ημερών μέχρι εξάντληση. Κόκκινο = κάτω από 3 ημέρες· κίτρινο = κάτω από 7 ημέρες.',
  },
  {
    q: 'How do I print buffet labels?',
    qEl: 'Πώς εκτυπώνω ετικέτες μπουφέ;',
    a: 'Open Menus → click on any menu → click on a menu item → select "Print Label". Choose the label size (Small 90×50mm, Medium 120×80mm, Large 150×100mm, or Custom mm), toggle options like price, allergen icons, and dietary badges, select EN or EL language, then click Print. Labels are generated as printable HTML.',
    aEl: 'Ανοίξτε Μενού → κλικ σε ένα μενού → κλικ σε item μενού → επιλέξτε "Εκτύπωση Ετικέτας". Επιλέξτε μέγεθος (Small 90×50mm, Medium 120×80mm, Large 150×100mm ή Custom), ρυθμίστε επιλογές τιμής, αλλεργιογόνων και διαιτητικών badges, γλώσσα EN ή EL, κατόπιν κλικ Εκτύπωση.',
  },
  {
    q: 'Does Chef Copilot write to my database?',
    qEl: 'Ο Chef Copilot γράφει στη βάση δεδομένων μου;',
    a: 'No. Chef Copilot only reads a snapshot of your kitchen data (recipes, inventory levels, recent waste) to provide context-aware answers. It cannot create, edit, or delete any records. All suggestions it makes must be applied manually by you.',
    aEl: 'Όχι. Ο Chef Copilot διαβάζει μόνο ένα στιγμιότυπο των δεδομένων κουζίνας (συνταγές, επίπεδα stock, πρόσφατη σπατάλη) για σχετικές απαντήσεις. Δεν μπορεί να δημιουργήσει, επεξεργαστεί ή διαγράψει εγγραφές. Όλες οι προτάσεις του εφαρμόζονται χειροκίνητα από εσάς.',
  },
  {
    q: 'Can I use ChefSuite in Greek?',
    qEl: 'Μπορώ να χρησιμοποιήσω το ChefSuite στα ελληνικά;',
    a: 'Yes. Click the language toggle at the very bottom of the sidebar to switch between English and Greek. The setting is saved in your browser and persists across sessions. All UI labels, page titles, and culinary library content switch instantly.',
    aEl: 'Ναι. Κλικ στον εναλλάκτη γλώσσας στο κάτω μέρος του sidebar για εναλλαγή μεταξύ αγγλικών και ελληνικών. Η ρύθμιση αποθηκεύεται στον browser και διατηρείται. Όλες οι ετικέτες UI, τίτλοι σελίδων και περιεχόμενο βιβλιοθήκης αλλάζουν αμέσως.',
  },
]

// ── Shortcuts ─────────────────────────────────────────────────
const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Focus sidebar search', labelEl: 'Εστίαση αναζήτησης sidebar' },
  { keys: ['Enter'],    label: 'Send chat message / Copilot prompt', labelEl: 'Αποστολή μηνύματος / ερώτησης' },
  { keys: ['Shift', 'Enter'], label: 'New line in chat / Copilot', labelEl: 'Νέα γραμμή σε chat / Copilot' },
  { keys: ['Esc'],      label: 'Clear search / close drawer', labelEl: 'Εκκαθάριση αναζήτησης / κλείσιμο' },
]

// ── Main component ────────────────────────────────────────────
function loadDone(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set()
  } catch { return new Set() }
}

export default function HelpCenter() {
  const { t, i18n } = useTranslation()
  const isEl = i18n.language.startsWith('el')

  const [done, setDone]         = useState<Set<string>>(loadDone)
  const [openFaq, setOpenFaq]   = useState<number | null>(null)
  const [openGroup, setOpenGroup] = useState<string | null>(null)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...done]))
  }, [done])

  function toggleStep(id: string) {
    setDone((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const progress = Math.round((done.size / STEPS.length) * 100)

  return (
    <div className="space-y-8 pb-8">

      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-orange/15 border border-brand-orange/25">
          <HelpCircle className="h-6 w-6 text-brand-orange" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">{t('help.title')}</h1>
          <p className="text-sm text-white/40 mt-1">{t('help.subtitle')}</p>
        </div>
      </div>

      {/* ── Getting Started ── */}
      <GlassCard className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-white">{t('help.gettingStarted')}</h2>
            <p className="text-xs text-white/40 mt-0.5">{t('help.gettingStartedDesc')}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1 min-w-[120px] h-1.5 rounded-full bg-white/10 overflow-hidden">
              <div className="h-full bg-brand-orange rounded-full transition-all duration-500"
                style={{ width: `${progress}%` }} />
            </div>
            <span className="text-xs font-semibold text-white/50 tabular-nums shrink-0">
              {done.size}/{STEPS.length}
            </span>
            {done.size > 0 && (
              <button type="button" onClick={() => setDone(new Set())}
                className="text-xs text-white/25 hover:text-white/50 transition shrink-0">
                {t('help.reset')}
              </button>
            )}
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {STEPS.map((step) => {
            const checked = done.has(step.id)
            return (
              <div key={step.id}
                className={cn('flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all glass',
                  checked && 'opacity-60')}>
                <button type="button" onClick={() => toggleStep(step.id)}
                  className={cn('shrink-0 transition-colors',
                    checked ? 'text-emerald-400' : 'text-white/25 hover:text-white/50')}>
                  {checked
                    ? <CheckCircle2 className="h-4 w-4" />
                    : <Circle className="h-4 w-4" />}
                </button>
                <span className={cn('text-sm flex-1 min-w-0 truncate', checked ? 'line-through text-white/40' : 'text-white/80')}>
                  {isEl ? step.labelEl : step.label}
                </span>
                <NavLink to={step.path}
                  className="text-white/20 hover:text-brand-orange transition shrink-0">
                  <ExternalLink className="h-3.5 w-3.5" />
                </NavLink>
              </div>
            )
          })}
        </div>
      </GlassCard>

      {/* ── Feature Reference ── */}
      <div className="space-y-3">
        <h2 className="font-semibold text-white/80 px-1">{t('help.features')}</h2>

        {FEATURE_GROUPS.map((group) => {
          const isOpen = openGroup === group.id
          return (
            <div key={group.id} className="glass rounded-2xl gradient-border overflow-hidden">
              <button type="button" onClick={() => setOpenGroup(isOpen ? null : group.id)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-white/3 transition">
                <span className="text-sm font-semibold text-white/70 uppercase tracking-wider">
                  {t(group.labelKey)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/30">{group.cards.length} modules</span>
                  {isOpen
                    ? <ChevronUp className="h-4 w-4 text-white/30" />
                    : <ChevronDown className="h-4 w-4 text-white/30" />}
                </div>
              </button>

              {isOpen && (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 p-4 pt-2 border-t border-white/6">
                  {group.cards.map((card) => (
                    <div key={card.path} className="glass rounded-xl p-4 space-y-2 hover:bg-white/3 transition">
                      <div className="flex items-center gap-2">
                        <card.icon className="h-4 w-4 text-brand-orange shrink-0" />
                        <span className="font-semibold text-sm text-white">
                          {isEl ? card.nameEl : card.name}
                        </span>
                        <NavLink to={card.path}
                          className="ml-auto text-white/20 hover:text-brand-orange transition shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </NavLink>
                      </div>
                      <p className="text-xs text-white/55 leading-relaxed">
                        {isEl ? card.descriptionEl : card.description}
                      </p>
                      <ul className="space-y-0.5 mt-1">
                        {(isEl ? card.bulletsEl : card.bullets).map((b, i) => (
                          <li key={i} className="flex gap-1.5 text-xs text-white/40">
                            <span className="text-brand-orange/60 shrink-0 mt-0.5">›</span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── FAQ ── */}
      <div className="space-y-3">
        <h2 className="font-semibold text-white/80 px-1">{t('help.faq')}</h2>
        <div className="space-y-2">
          {FAQ.map((item, i) => {
            const isOpen = openFaq === i
            return (
              <div key={i} className="glass rounded-2xl gradient-border overflow-hidden">
                <button type="button" onClick={() => setOpenFaq(isOpen ? null : i)}
                  className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/3 transition">
                  <span className="text-sm font-medium text-white/80">
                    {isEl ? item.qEl : item.q}
                  </span>
                  {isOpen
                    ? <ChevronUp className="h-4 w-4 text-white/30 shrink-0" />
                    : <ChevronDown className="h-4 w-4 text-white/30 shrink-0" />}
                </button>
                {isOpen && (
                  <div className="px-5 pb-4 border-t border-white/6 pt-3">
                    <p className="text-sm text-white/60 leading-relaxed">
                      {isEl ? item.aEl : item.a}
                    </p>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Keyboard Shortcuts ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2 px-1">
          <Keyboard className="h-4 w-4 text-white/30" />
          <h2 className="font-semibold text-white/80">{t('help.shortcuts')}</h2>
        </div>
        <GlassCard className="!p-0">
          <div className="divide-y divide-white/5">
            {SHORTCUTS.map((s, i) => (
              <div key={i} className="flex items-center justify-between px-5 py-3">
                <span className="text-sm text-white/60">
                  {isEl ? s.labelEl : s.label}
                </span>
                <div className="flex items-center gap-1">
                  {s.keys.map((k) => (
                    <kbd key={k} className="px-2 py-0.5 rounded-md bg-white/8 border border-white/12 text-xs font-mono text-white/50">
                      {k}
                    </kbd>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>

      {/* ── Quick tip ── */}
      <div className="flex items-start gap-3 rounded-xl border border-brand-orange/20 bg-brand-orange/5 px-4 py-3 text-sm text-brand-orange/80">
        <Sparkles className="h-4 w-4 mt-0.5 shrink-0 text-brand-orange" />
        <p>{t('help.tip')}</p>
      </div>
    </div>
  )
}
