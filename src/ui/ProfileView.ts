/**
 * ProfileView.ts — interactive, editable player profile with persistence, statistics,
 * and custom avatar upload support.
 */

import { LocalStorage } from '../storage/LocalStorage';
import { levelFromXp, levelProgress, xpForNextLevel, titleForLevel } from '../player/Progression';
import type { ScoreSnapshot } from '../game/ScoreManager';

export interface PlayerProfile {
  name: string;
  title: string;
  avatar: string; // 'mascot' | 'rock' | 'paper' | 'scissors' | 'trophy' | 'star' | data:image/...
  bio: string;
}

const STORAGE_KEY = 'vrps_player_profile';

const DEFAULT_PROFILE: PlayerProfile = {
  name: 'Vision Master',
  title: 'Novice Duelist',
  avatar: 'mascot',
  bio: 'Mastering Rock, Paper, Scissors with live computer vision gestures.',
};

const AVATAR_SVGS: Record<string, string> = {
  mascot: '<img src="/icon.jpg" alt="Mascot Avatar" class="profile-avatar-img" />',
  rock: '<svg class="avatar-svg" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11.5V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v1.4"></path><path d="M14 10V8a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"></path><path d="M10 9.9V9a2 2 0 0 0-2-2a2 2 0 0 0-2 2v5"></path><path d="M6 14a2 2 0 0 0-2-2a2 2 0 0 0-2 2"></path><path d="M18 11a2 2 0 1 1 4 0v3a8 8 0 0 1-8 8h-4a8 8 0 0 1-8-8 2 2 0 1 1 4 0"></path></svg>',
  paper: '<svg class="avatar-svg" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2"></path><path d="M14 10V4a2 2 0 0 0-2-2a2 2 0 0 0-2 2v2"></path><path d="M10 10.5V6a2 2 0 0 0-2-2a2 2 0 0 0-2 2v8"></path><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"></path></svg>',
  scissors: '<svg class="avatar-svg" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"></circle><path d="M8.12 8.12 12 12"></path><path d="M20 4 8.12 15.88"></path><circle cx="6" cy="18" r="3"></circle><path d="M14.8 14.8 20 20"></path></svg>',
  trophy: '<svg class="avatar-svg" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path><path d="M4 22h16"></path><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path></svg>',
  star: '<svg class="avatar-svg" xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>',
};

function renderAvatarHtml(avatar: string): string {
  if (avatar && (avatar.startsWith('data:image/') || avatar.startsWith('blob:') || avatar.startsWith('http'))) {
    return `<img src="${avatar}" alt="Custom Profile Photo" class="profile-avatar-img custom-avatar-img" />`;
  }
  return AVATAR_SVGS[avatar] || AVATAR_SVGS.mascot;
}

export class ProfileView {
  private storage: LocalStorage;
  private profile: PlayerProfile;
  private selectedAvatar: string;
  private onProfileUpdate?: (profile: PlayerProfile) => void;

  constructor(options: { storage?: LocalStorage; onProfileUpdate?: (p: PlayerProfile) => void } = {}) {
    this.storage = options.storage || new LocalStorage();
    this.onProfileUpdate = options.onProfileUpdate;
    this.profile = this._loadProfile();
    this.selectedAvatar = this.profile.avatar;
    this._bindEvents();
    this.render();
  }

  private _loadProfile(): PlayerProfile {
    try {
      const rawStr = this.storage.getItem(STORAGE_KEY);
      if (rawStr) {
        const raw = JSON.parse(rawStr) as Partial<PlayerProfile>;
        if (raw && typeof raw === 'object' && raw.name) {
          return {
            name: String(raw.name).trim() || DEFAULT_PROFILE.name,
            title: String(raw.title || DEFAULT_PROFILE.title),
            avatar: String(raw.avatar || DEFAULT_PROFILE.avatar),
            bio: String(raw.bio || DEFAULT_PROFILE.bio),
          };
        }
      }
    } catch {
      /* fallback to default */
    }
    return { ...DEFAULT_PROFILE };
  }

  private _saveProfile(profile: PlayerProfile): void {
    this.profile = { ...profile };
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.profile));
    } catch {
      /* storage quota fallback */
    }
    this.onProfileUpdate?.(this.profile);
  }

  getProfile(): PlayerProfile {
    return { ...this.profile };
  }

  render(scores?: ScoreSnapshot): void {
    // 1. Update Display View
    const nameEl = document.getElementById('profile-name');
    if (nameEl) nameEl.textContent = this.profile.name;

    const titleEl = document.getElementById('profile-title-display');
    if (titleEl) titleEl.textContent = this.profile.title;

    const bioEl = document.getElementById('profile-bio-display');
    if (bioEl) bioEl.textContent = this.profile.bio;

    const avatarContainer = document.getElementById('profile-avatar-display');
    if (avatarContainer) {
      avatarContainer.innerHTML = renderAvatarHtml(this.profile.avatar);
    }

    // 2. Progression & XP Calculation
    const totalRounds = (scores?.playerWins ?? 0) + (scores?.computerWins ?? 0) + (scores?.draws ?? 0);
    const totalWins = scores?.playerWins ?? 0;
    // Estimate XP: 30 XP per win + 10 XP per round played
    const xp = totalWins * 30 + totalRounds * 10;
    const level = levelFromXp(xp);
    const progress = Math.round(levelProgress(xp) * 100);
    const nextLevelXp = xpForNextLevel(level);

    const levelTextEl = document.getElementById('profile-level');
    if (levelTextEl) {
      levelTextEl.textContent = `Level ${level} · ${titleForLevel(level)} (${xp} XP)`;
    }

    const progressFill = document.getElementById('profile-xp-fill');
    if (progressFill) {
      progressFill.style.width = `${Math.min(100, Math.max(0, progress))}%`;
    }

    const progressText = document.getElementById('profile-xp-text');
    if (progressText) {
      progressText.textContent = `${progress}% to Level ${level + 1} (${nextLevelXp} XP)`;
    }

    // 3. Stats Rows
    const roundsEl = document.getElementById('profile-rounds');
    if (roundsEl) roundsEl.textContent = String(totalRounds);

    const matchesEl = document.getElementById('profile-matches');
    if (matchesEl) matchesEl.textContent = String(Math.floor(totalRounds / 3));

    const streakEl = document.getElementById('profile-streak');
    if (streakEl) streakEl.textContent = String(totalWins > 0 ? Math.max(1, Math.min(totalWins, 5)) : 0);

    const winRateEl = document.getElementById('profile-winrate');
    if (winRateEl) {
      const pct = totalRounds > 0 ? Math.round((totalWins / totalRounds) * 100) : 0;
      winRateEl.textContent = `${pct}%`;
    }

    // Sync to Dashboard Greeting
    const dashWelcome = document.getElementById('dash-welcome-name');
    if (dashWelcome) dashWelcome.textContent = this.profile.name;
  }

  private _bindEvents(): void {
    const editBtn = document.getElementById('btn-edit-profile');
    const cancelBtn = document.getElementById('btn-cancel-profile');
    const saveBtn = document.getElementById('btn-save-profile');
    const resetBtn = document.getElementById('btn-reset-profile');

    const displayCard = document.getElementById('profile-display-card');
    const editForm = document.getElementById('profile-edit-form');

    editBtn?.addEventListener('click', () => {
      this._openEditForm();
      displayCard?.classList.add('hidden');
      editForm?.classList.remove('hidden');
    });

    cancelBtn?.addEventListener('click', () => {
      editForm?.classList.add('hidden');
      displayCard?.classList.remove('hidden');
    });

    saveBtn?.addEventListener('click', () => {
      this._handleSave();
      editForm?.classList.add('hidden');
      displayCard?.classList.remove('hidden');
    });

    resetBtn?.addEventListener('click', () => {
      this.selectedAvatar = DEFAULT_PROFILE.avatar;
      (document.getElementById('input-profile-name') as HTMLInputElement).value = DEFAULT_PROFILE.name;
      (document.getElementById('select-profile-title') as HTMLSelectElement).value = DEFAULT_PROFILE.title;
      (document.getElementById('input-profile-bio') as HTMLTextAreaElement).value = DEFAULT_PROFILE.bio;
      const fileInput = document.getElementById('input-profile-custom-image') as HTMLInputElement | null;
      if (fileInput) fileInput.value = '';
      this._updateAvatarPickerActive();
    });

    // Preset Avatar picker buttons
    document.querySelectorAll<HTMLButtonElement>('[data-avatar-choice]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const choice = btn.dataset.avatarChoice;
        if (choice && AVATAR_SVGS[choice]) {
          this.selectedAvatar = choice;
          this._updateAvatarPickerActive();
        }
      });
    });

    // Custom photo file input and upload button
    const uploadBtn = document.getElementById('btn-upload-custom-avatar');
    const fileInput = document.getElementById('input-profile-custom-image') as HTMLInputElement | null;

    uploadBtn?.addEventListener('click', () => {
      fileInput?.click();
    });

    fileInput?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      const file = target.files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (loadEvt) => {
        const dataUrl = loadEvt.target?.result as string;
        if (!dataUrl) return;

        // Process and compress image through canvas (256x256, JPEG 0.85)
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = 256;
          canvas.height = 256;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Center crop with cover aspect ratio
            const scale = Math.max(256 / img.width, 256 / img.height);
            const x = (256 - img.width * scale) / 2;
            const y = (256 - img.height * scale) / 2;
            ctx.drawImage(img, x, y, img.width * scale, img.height * scale);

            const compressedUrl = canvas.toDataURL('image/jpeg', 0.85);
            this.selectedAvatar = compressedUrl;
            this._updateAvatarPickerActive();
          }
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  private _openEditForm(): void {
    this.selectedAvatar = this.profile.avatar;
    const nameInput = document.getElementById('input-profile-name') as HTMLInputElement | null;
    const titleSelect = document.getElementById('select-profile-title') as HTMLSelectElement | null;
    const bioInput = document.getElementById('input-profile-bio') as HTMLTextAreaElement | null;

    if (nameInput) nameInput.value = this.profile.name;
    if (titleSelect) titleSelect.value = this.profile.title;
    if (bioInput) bioInput.value = this.profile.bio;

    this._updateAvatarPickerActive();
  }

  private _updateAvatarPickerActive(): void {
    const isCustom = this.selectedAvatar.startsWith('data:image/') || this.selectedAvatar.startsWith('blob:');

    document.querySelectorAll<HTMLButtonElement>('[data-avatar-choice]').forEach((btn) => {
      const isSelected = !isCustom && btn.dataset.avatarChoice === this.selectedAvatar;
      btn.classList.toggle('active', isSelected);
      btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
    });

    const uploadBtn = document.getElementById('btn-upload-custom-avatar');
    const preview = document.getElementById('custom-avatar-preview');

    if (uploadBtn) {
      uploadBtn.classList.toggle('active', isCustom);
      uploadBtn.setAttribute('aria-pressed', isCustom ? 'true' : 'false');
    }

    if (preview) {
      if (isCustom) {
        preview.innerHTML = `<img src="${this.selectedAvatar}" alt="Custom Preview" class="custom-avatar-thumb" />`;
      } else {
        preview.innerHTML = `<svg class="nav-svg" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>`;
      }
    }
  }

  private _handleSave(): void {
    const nameInput = document.getElementById('input-profile-name') as HTMLInputElement | null;
    const titleSelect = document.getElementById('select-profile-title') as HTMLSelectElement | null;
    const bioInput = document.getElementById('input-profile-bio') as HTMLTextAreaElement | null;

    const newName = nameInput?.value.trim() || DEFAULT_PROFILE.name;
    const newTitle = titleSelect?.value || DEFAULT_PROFILE.title;
    const newBio = bioInput?.value.trim() || DEFAULT_PROFILE.bio;

    this._saveProfile({
      name: newName,
      title: newTitle,
      avatar: this.selectedAvatar,
      bio: newBio,
    });

    this.render();

    // Show temporary saved toast
    const toast = document.getElementById('profile-saved-toast');
    if (toast) {
      toast.classList.remove('hidden');
      setTimeout(() => toast.classList.add('hidden'), 2800);
    }
  }
}
