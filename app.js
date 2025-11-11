// ============================================
// HABIT TRACKER CLI - CHALLENGE 3
// ============================================
// NAMA: WPH-015-Made Bambang
// KELAS: WPH-REP
// TANGGAL: 11-Nov-2025
// ============================================

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, 'habits-data.json');
const REMINDER_INTERVAL = 10000; // 10 detik
const DAYS_IN_WEEK = 7;
const PROGRESS_BAR_WIDTH = 10;

// ---------- Utility functions ----------
const todayISO = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function parseDateISO(dateStr) {
  return new Date(dateStr + 'T00:00:00');
}

// get last N days array of date strings including today
function lastNDatesISO(n) {
  const dates = [];
  for (let i = 0; i < n; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(d.toISOString().slice(0, 10));
  }
  return dates;
}

function clearConsole() {
  console.clear();
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ascii progress bar
function progressBar(percentage) {
  const filled = Math.round((percentage / 100) * PROGRESS_BAR_WIDTH);
  const empty = PROGRESS_BAR_WIDTH - filled;
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${percentage}%`;
}

// ---------- User Profile Object ----------
const userProfile = {
  name: 'User' ?? 'NoName', // example of nullish coalescing (default)
  createdAt: new Date().toISOString(),
  updateName(newName) {
    this.name = newName ?? this.name;
  },
  getDaysJoined() {
    const created = new Date(this.createdAt);
    const now = new Date();
    const diff = Math.floor((now - created) / (1000 * 60 * 60 * 24));
    return diff >= 0 ? diff : 0;
  },
  updateStats(habits = []) {
    // compute summary stats
    const total = habits.length;
    const completedThisWeek = habits.filter(h => h.isCompletedThisWeek()).length;
    const active = total - completedThisWeek;
    return { total, completedThisWeek, active, daysJoined: this.getDaysJoined() };
  }
};

// ---------- Habit Class ----------
class Habit {
  constructor({ id = null, name = 'Unnamed', targetFrequency = 7, completions = [], createdAt = null, category = null } = {}) {
    this.id = id ?? Date.now() + Math.floor(Math.random() * 999);
    this.name = name;
    this.targetFrequency = Number(targetFrequency ?? 7);
    this.completions = completions ?? []; // array of ISO date strings YYYY-MM-DD
    this.createdAt = createdAt ?? new Date().toISOString();
    this.category = category ?? 'General'; // bonus: category
  }

  // mark completion for today (only once per day)
  markComplete() {
    const today = todayISO();
    const already = this.completions.find(d => d === today);
    if (!already) {
      this.completions.push(today);
      return true;
    }
    return false;
  }

  // return completions in the last DAYS_IN_WEEK days (including today)
  getThisWeekCompletions() {
    const lastDates = new Set(lastNDatesISO(DAYS_IN_WEEK));
    return this.completions.filter(d => lastDates.has(d));
  }

  // check if target fulfilled this week
  isCompletedThisWeek() {
    return this.getThisWeekCompletions().length >= this.targetFrequency;
  }

  // percent progress for this week
  getProgressPercentage() {
    const done = this.getThisWeekCompletions().length;
    const pct = Math.floor((done / this.targetFrequency) * 100);
    return Math.min(100, Math.max(0, pct || 0));
  }

  // status label
  getStatus() {
    return this.isCompletedThisWeek() ? 'Selesai' : 'Aktif';
  }

  // get current streak (consecutive days up to today)
  getStreak() {
    // Sort unique completions descending
    const unique = Array.from(new Set(this.completions)).sort((a,b) => b.localeCompare(a));
    let streak = 0;
    let d = new Date();
    for (let i = 0; i < unique.length; i++) {
      const dateStr = unique[i];
      if (dateStr === d.toISOString().slice(0,10)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        // if the current date doesn't match, break if next date isn't consecutive
        const expected = new Date(d);
        expected.setDate(expected.getDate());
        const expectedStr = expected.toISOString().slice(0,10);
        if (dateStr === expectedStr) {
          streak++;
          d.setDate(d.getDate() - 1);
        } else {
          break;
        }
      }
    }
    return streak;
  }
}

// ---------- HabitTracker Class ----------
class HabitTracker {
  constructor({ user = userProfile, habits = [] } = {}) {
    this.user = user;
    this.habits = (habits || []).map(h => new Habit(h));
    this.reminderTimer = null;
  }

  // CRUD
  addHabit(name, frequency = 7, category = 'General') {
    const h = new Habit({ name: name ?? 'Untitled', targetFrequency: frequency ?? 7, category });
    this.habits.push(h);
    this.saveToFile();
    return h;
  }

  completeHabit(index) {
    const habit = this.habits[index];
    if (!habit) return { ok: false, message: 'Habit tidak ditemukan.' };
    const done = habit.markComplete();
    this.saveToFile();
    return { ok: done, habit };
  }

  deleteHabit(index) {
    if (index < 0 || index >= this.habits.length) return false;
    this.habits.splice(index, 1);
    this.saveToFile();
    return true;
  }

  // Display / filters
  displayProfile() {
    const stats = this.user.updateStats(this.habits);
    console.log('==================================================');
    console.log('PROFILE');
    console.log('==================================================');
    console.log(`Nama       : ${this.user.name}`);
    console.log(`Bergabung  : ${this.user.createdAt.slice(0,10)} (${stats.daysJoined} hari)`);
    console.log(`Total Habit: ${stats.total}`);
    console.log(`Selesai minggu ini: ${stats.completedThisWeek}`);
    console.log(`Aktif minggu ini  : ${stats.active}`);
    console.log('==================================================\n');
  }

displayHabits(filter = 'all') {
    let list = this.habits;
    if (filter === 'active') {
      list = list.filter(h => !h.isCompletedThisWeek());
    } else if (filter === 'completed') {
      // Pertama cari yang benar-benar mencapai target
      const full = list.filter(h => h.isCompletedThisWeek());
      if (full.length > 0) {
        list = full;
      } else {
        // Jika tidak ada yang mencapai target, tampilkan yang punya minimal 1 completion minggu ini
        const partial = list.filter(h => h.getThisWeekCompletions().length > 0);
        if (partial.length > 0) {
          console.log('Tidak ada habit yang mencapai target minggu ini. Menampilkan habit yang sudah memiliki progress minggu ini:\n');
          list = partial;
        } else {
          // benar-benar kosong
          console.log('Belum ada habit yang selesai atau memiliki progress minggu ini.');
          return;
        }
      }
    }

    if (list.length === 0) {
      console.log('Belum ada habit yang ditampilkan.');
      return;
    }

    list.forEach((h, idx) => {
      const done = h.getThisWeekCompletions().length;
      const pct = h.getProgressPercentage();
      console.log(`${idx + 1}. [${h.getStatus()}] ${h.name}`);
      console.log(`   Target: ${h.targetFrequency}x/minggu  | Category: ${h.category}`);
      console.log(`   Progress: ${done}/${h.targetFrequency} (${pct}%)`);
      console.log(`   Progress Bar: ${progressBar(pct)}`);
      console.log(`   Streak: ${h.getStreak()} hari`);
      console.log('');
    });
  }

  // Demonstrasi while loop (menggunakan while)
  displayHabitsWithWhile() {
    console.log('--- Demo While Loop ---');
    let i = 0;
    while (i < this.habits.length) {
      const h = this.habits[i];
      console.log(`${i + 1}. ${h.name} - ${h.getStatus()}`);
      i++;
    }
    console.log('--- End While Demo ---\n');
  }

  // Demonstrasi for loop
  displayHabitsWithFor() {
    console.log('--- Demo For Loop ---');
    for (let i = 0; i < this.habits.length; i++) {
      const h = this.habits[i];
      console.log(`${i + 1}. ${h.name} - Target ${h.targetFrequency}/minggu`);
    }
    console.log('--- End For Demo ---\n');
  }

  // Statistics using array methods (map/filter/reduce/forEach/find)
  displayStats() {
    console.log('--- Statistik ---');
    const total = this.habits.length;
    const completed = this.habits.filter(h => h.isCompletedThisWeek()).length;
    const active = total - completed;

    // map example
    const names = this.habits.map(h => h.name);

    // forEach example
    let totalTargets = 0;
    this.habits.forEach(h => totalTargets += h.targetFrequency);

    // find example - find the highest target habit
    const highest = this.habits.find(h => h.targetFrequency === Math.max(...this.habits.map(x => x.targetFrequency)));
    console.log(`Total habits     : ${total}`);
    console.log(`Selesai minggu ini: ${completed}`);
    console.log(`Aktif minggu ini  : ${active}`);
    console.log(`Nama-nama habit   : ${names.join(', ') || '-'}`);
    console.log(`Total target/week : ${totalTargets}`);
    console.log(`Habit with highest target: ${highest ? highest.name + ' (' + highest.targetFrequency + ')' : '-'}`);
    console.log('--- End Statistik ---\n');
  }

  // Reminder system
  startReminder() {
    if (this.reminderTimer) return;
    this.reminderTimer = setInterval(() => this.showReminder(), REMINDER_INTERVAL);
  }

  showReminder() {
    // pick an active habit (not completed this week) or random if all completed
    const active = this.habits.filter(h => !h.isCompletedThisWeek());
    const pool = active.length ? active : this.habits;
    if (!pool || pool.length === 0) return;
    const pick = pool[Math.floor(Math.random() * pool.length)];
    console.log('\n==================================================');
    console.log(`REMINDER: Jangan lupa "${pick.name}"! (Status: ${pick.getStatus()})`);
    console.log('==================================================\n');
  }

  stopReminder() {
    if (this.reminderTimer) {
      clearInterval(this.reminderTimer);
      this.reminderTimer = null;
    }
  }

  // Persistence
  saveToFile() {
    const data = {
      user: {
        name: this.user.name,
        createdAt: this.user.createdAt
      },
      habits: this.habits.map(h => ({
        id: h.id,
        name: h.name,
        targetFrequency: h.targetFrequency,
        completions: h.completions,
        createdAt: h.createdAt,
        category: h.category
      }))
    };
    try {
      fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('Gagal menyimpan data:', err.message);
    }
  }

  loadFromFile() {
    try {
      if (!fs.existsSync(DATA_FILE)) {
        // create default minimal file
        const defaultData = {
          user: { name: this.user.name ?? 'User', createdAt: this.user.createdAt },
          habits: []
        };
        fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf8');
        return;
      }
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      // nullish coalescing examples:
      this.user.name = parsed.user?.name ?? this.user.name;
      this.user.createdAt = parsed.user?.createdAt ?? this.user.createdAt;
      this.habits = (parsed.habits ?? []).map(h => new Habit(h));
    } catch (err) {
      console.error('Gagal memuat data:', err.message);
    }
  }

  clearAllData() {
    this.habits = [];
    this.user = { name: this.user.name ?? 'User', createdAt: new Date().toISOString(), updateName: userProfile.updateName, getDaysJoined: userProfile.getDaysJoined, updateStats: userProfile.updateStats };
    this.saveToFile();
  }

  // helper to list habits names (map example)
  habitNames() {
    return this.habits.map(h => h.name);
  }
}

// ---------- CLI Interaction ----------
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(q) {
  return new Promise(resolve => rl.question(q, ans => resolve(ans)));
}

async function displayMenu() {
  console.log('==================================================');
  console.log('HABIT TRACKER - MAIN MENU');
  console.log('==================================================');
  console.log('1. Lihat Profil');
  console.log('2. Lihat Semua Kebiasaan');
  console.log('3. Lihat Kebiasaan Aktif');
  console.log('4. Lihat Kebiasaan Selesai');
  console.log('5. Tambah Kebiasaan Baru');
  console.log('6. Tandai Kebiasaan Selesai (hari ini)');
  console.log('7. Hapus Kebiasaan');
  console.log('8. Lihat Statistik');
  console.log('9. Demo Loop (while/for)');
  console.log('0. Keluar');
  console.log('==================================================');
}

async function handleMenu(tracker) {
  while (true) {
    await displayMenu();
    const ans = await askQuestion('Pilih menu (0-9): ');
    const choice = Number(ans ?? -1);
    clearConsole();
    switch (choice) {
      case 1:
        tracker.displayProfile();
        break;
      case 2:
        tracker.displayHabits('all');
        break;
      case 3:
        tracker.displayHabits('active');
        break;
      case 4:
        tracker.displayHabits('completed');
        break;
      case 5: {
        const name = (await askQuestion('Nama kebiasaan: ')).trim() ?? '';
        const freqRaw = (await askQuestion('Target per minggu (angka): ')).trim();
        const category = (await askQuestion('Kategori (opsional): ')).trim() || 'General';
        const frequency = parseInt(freqRaw) || 7;
        if (!name) {
          console.log('Nama tidak boleh kosong.');
        } else {
          const newH = tracker.addHabit(name, frequency, category);
          console.log(`Berhasil menambah habit: ${newH.name} (Target ${newH.targetFrequency}/minggu)`);
        }
        break;
      }
      case 6: {
        if (tracker.habits.length === 0) {
          console.log('Belum ada habit.');
          break;
        }
        tracker.displayHabits('all');
        const idxRaw = await askQuestion('Pilih nomor habit untuk ditandai selesai hari ini: ');
        const idx = Number(idxRaw) - 1;
        const result = tracker.completeHabit(idx);
        if (!result.ok) {
          console.log(result.message ?? 'Sudah ditandai hari ini atau index salah.');
        } else {
          console.log(`Habit "${result.habit.name}" berhasil ditandai selesai untuk hari ini.`);
        }
        break;
      }
      case 7: {
        if (tracker.habits.length === 0) {
          console.log('Belum ada habit.');
          break;
        }
        tracker.displayHabits('all');
        const idxRaw = await askQuestion('Pilih nomor habit yang ingin dihapus: ');
        const idx = Number(idxRaw) - 1;
        const confirmed = (await askQuestion('Yakin hapus? (y/n): ')).toLowerCase();
        if (confirmed === 'y') {
          const ok = tracker.deleteHabit(idx);
          console.log(ok ? 'Berhasil dihapus.' : 'Gagal menghapus (index mungkin salah).');
        } else {
          console.log('Dibatalkan.');
        }
        break;
      }
      case 8:
        tracker.displayStats();
        break;
      case 9:
        // demo loops
        tracker.displayHabitsWithWhile();
        tracker.displayHabitsWithFor();
        break;
      case 0:
        console.log('Keluar. Sampai jumpa!');
        tracker.stopReminder();
        tracker.saveToFile();
        rl.close();
        return;
      default:
        console.log('Pilihan tidak valid. Masukkan angka 0-9.');
    }

    console.log('\nTekan Enter untuk kembali ke menu...');
    await askQuestion('');
    clearConsole();
  }
}


// ---------- Main ----------
async function main() {
  clearConsole();
  console.log('==================================================');
  console.log('      SELAMAT DATANG DI HABIT TRACKER CLI');
  console.log('==================================================\n');
  const tracker = new HabitTracker({ user: userProfile });
  tracker.loadFromFile();

  // start reminder auto
  tracker.startReminder();

  // optional demo data (only if no habits exist)
  if ((tracker.habits ?? []).length === 0) {
    // populate demo habits (won't override file if file already had habits)
    tracker.addHabit('Minum Air 8 Gelas', 7, 'Kesehatan');
    tracker.addHabit('Baca Buku 30 Menit', 5, 'Belajar');
    tracker.addHabit('Olahraga Ringan', 3, 'Kesehatan');
    console.log('Demo data ditambahkan (karena data kosong).');
  }

  await handleMenu(tracker);
}

main();
