/**
 * Simple i18n for English and Malayalam.
 * When locale is Malayalam (ml), Manjari font is applied app-wide via data-locale.
 */

export type Locale = 'en' | 'ml';

export const translations: Record<Locale, Record<string, string>> = {
  en: {
    // Settings
    settings: 'Settings',
    manageAccountPreferences: 'Manage your account settings and preferences',
    language: 'Language',
    languageDescription: 'Choose your preferred language. Malayalam uses Manjari font for better readability.',
    english: 'English',
    malayalam: 'മലയാളം',
    appearance: 'Appearance',
    profileInformation: 'Profile Information',
    changePassword: 'Change Password',
    back: 'Back',
    saveChanges: 'Save Changes',
    updatePassword: 'Update Password',
    colorTheme: 'Color Theme',
    light: 'Light',
    dark: 'Dark',
    system: 'System',
    needHelp: 'Need Help?',
    contactSupport: 'Contact Support',
    accountDetails: 'Account Details',
    role: 'Role',
    department: 'Department',
    division: 'Division',
    profilePhoto: 'Profile photo',
    changePhoto: 'Change photo',
    uploading: 'Uploading...',
    fullName: 'Full Name',
    emailAddress: 'Email Address',
    currentPassword: 'Current Password',
    newPassword: 'New Password',
    confirmPassword: 'Confirm Password',
    // Common
    dashboard: 'Dashboard',
    inbox: 'Inbox',
    files: 'Files',
    newFile: 'New File',
    trackFile: 'Track File',
    logout: 'Log out',
  },
  ml: {
    settings: 'ക്രമീകരണങ്ങൾ',
    manageAccountPreferences: 'നിങ്ങളുടെ അക്കൗണ്ട് ക്രമീകരണങ്ങളും മുൻഗണനകളും നിയന്ത്രിക്കുക',
    language: 'ഭാഷ',
    languageDescription: 'നിങ്ങളുടെ ഇഷ്ട ഭാഷ തിരഞ്ഞെടുക്കുക. മലയാളത്തിന് മഞ്ജരി ഫോണ്ട് ഉപയോഗിക്കുന്നു.',
    english: 'English',
    malayalam: 'മലയാളം',
    appearance: 'രൂപം',
    profileInformation: 'പ്രൊഫൈൽ വിവരങ്ങൾ',
    changePassword: 'പാസ്‌വേഡ് മാറ്റുക',
    back: 'പിന്നോട്ട്',
    saveChanges: 'മാറ്റങ്ങൾ സംരക്ഷിക്കുക',
    updatePassword: 'പാസ്‌വേഡ് അപ്‌ഡേറ്റ് ചെയ്യുക',
    colorTheme: 'നിറ തീം',
    light: 'ലൈറ്റ്',
    dark: 'ഡാർക്ക്',
    system: 'സിസ്റ്റം',
    needHelp: 'സഹായം വേണോ?',
    contactSupport: 'സപ്പോർട്ടുമായി ബന്ധപ്പെടുക',
    accountDetails: 'അക്കൗണ്ട് വിശദാംശങ്ങൾ',
    role: 'റോൾ',
    department: 'ഡിപ്പാർട്ട്മെന്റ്',
    division: 'ഡിവിഷൻ',
    profilePhoto: 'പ്രൊഫൈൽ ഫോട്ടോ',
    changePhoto: 'ഫോട്ടോ മാറ്റുക',
    uploading: 'അപ്‌ലോഡ് ചെയ്യുന്നു...',
    fullName: 'പൂർണ്ണ നാമം',
    emailAddress: 'ഇമെയിൽ വിലാസം',
    currentPassword: 'നിലവിലെ പാസ്‌വേഡ്',
    newPassword: 'പുതിയ പാസ്‌വേഡ്',
    confirmPassword: 'പാസ്‌വേഡ് സ്ഥിരീകരിക്കുക',
    dashboard: 'ഡാഷ്ബോർഡ്',
    inbox: 'ഇൻബോക്സ്',
    files: 'ഫയലുകൾ',
    newFile: 'പുതിയ ഫയൽ',
    trackFile: 'ഫയൽ ട്രാക്ക് ചെയ്യുക',
    logout: 'ലോഗൗട്ട്',
  },
};

export function getTranslation(locale: Locale, key: string): string {
  const localeMap = translations[locale];
  return localeMap[key] ?? translations.en[key] ?? key;
}
