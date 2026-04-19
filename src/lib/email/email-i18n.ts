// =============================================================================
// Email-specific translations — server-safe, no react-i18next dependency.
// Covers all content used in transactional email templates.
// =============================================================================

import { isSupportedLang, FALLBACK_LANG } from '@/i18n/shared'
import type { SupportedLang } from '@/i18n/shared'

export function resolveEmailLang(raw: string | null | undefined): SupportedLang {
  return isSupportedLang(raw) ? raw : FALLBACK_LANG
}

// ─── Verify Email ─────────────────────────────────────────────────────────────

export interface VerifyEmailStrings {
  subject:            string
  previewText:        string
  eyebrow:            string
  headline:           string
  subheadline:        string
  headerContextLabel: string
  greeting:           string
  p1:                 string
  p2:                 string
  infoBlockTitle:     string
  ctaLabel:           string
  footnote:           string
  textBody:           string
}

const verifyEmailTranslations: Record<SupportedLang, VerifyEmailStrings> = {
  en: {
    subject:            'Verify your email — Used Car Inspector AI',
    previewText:        'Verify your email to activate your Used Car Inspector AI account.',
    eyebrow:            'Account Verification',
    headline:           'Verify your email address',
    subheadline:        'One click and you\'re ready to inspect your next car.',
    headerContextLabel: 'Verification Link',
    greeting:           'Hi {{name}},',
    p1:                 'Thanks for creating your Used Car Inspector AI account. To start using all features, please verify your email address by clicking the button below.',
    p2:                 'This link is valid for <strong style="color:#ffffff;">{{hours}} hours</strong>. After that, you can request a new one from the settings page.',
    infoBlockTitle:     'What happens next?',
    ctaLabel:           'Verify Email Address',
    footnote:           'If you didn\'t create an account with Used Car Inspector AI, you can safely ignore this email. No action is needed.',
    textBody:
`Hi {{name}},

Thanks for creating your Used Car Inspector AI account.

To verify your email address, visit the link below:
{{url}}

This link is valid for {{hours}} hours.

If you didn't create an account, you can safely ignore this email.

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },

  sr: {
    subject:            'Potvrdite vašu e-poštu — Used Car Inspector AI',
    previewText:        'Potvrdite e-poštu da biste aktivirali vaš Used Car Inspector AI nalog.',
    eyebrow:            'Verifikacija naloga',
    headline:           'Potvrdite vašu e-adresu',
    subheadline:        'Jedan klik i možete početi sa pregledanjem vozila.',
    headerContextLabel: 'Link za verifikaciju',
    greeting:           'Zdravo {{name}},',
    p1:                 'Hvala što ste kreirali Used Car Inspector AI nalog. Da biste počeli koristiti sve funkcije, molimo potvrdite vašu e-adresu klikom na dugme ispod.',
    p2:                 'Ovaj link važi <strong style="color:#ffffff;">{{hours}} sata</strong>. Nakon toga, možete zatražiti novi putem stranice sa podešavanjima.',
    infoBlockTitle:     'Šta se dešava dalje?',
    ctaLabel:           'Potvrdi e-adresu',
    footnote:           'Ako niste kreirali nalog na Used Car Inspector AI, slobodno ignorišite ovaj e-mail. Nije potrebna nikakva akcija.',
    textBody:
`Zdravo {{name}},

Hvala što ste kreirali Used Car Inspector AI nalog.

Da biste potvrdili e-adresu, posetite link ispod:
{{url}}

Ovaj link važi {{hours}} sata.

Ako niste kreirali nalog, slobodno ignorišite ovaj e-mail.

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },

  de: {
    subject:            'E-Mail-Adresse bestätigen — Used Car Inspector AI',
    previewText:        'Bestätigen Sie Ihre E-Mail-Adresse, um Ihr Used Car Inspector AI-Konto zu aktivieren.',
    eyebrow:            'Kontobestätigung',
    headline:           'E-Mail-Adresse bestätigen',
    subheadline:        'Ein Klick und Sie können Ihr nächstes Auto inspizieren.',
    headerContextLabel: 'Bestätigungslink',
    greeting:           'Hallo {{name}},',
    p1:                 'Vielen Dank, dass Sie ein Used Car Inspector AI-Konto erstellt haben. Um alle Funktionen nutzen zu können, bestätigen Sie bitte Ihre E-Mail-Adresse über den Button unten.',
    p2:                 'Dieser Link ist <strong style="color:#ffffff;">{{hours}} Stunden</strong> gültig. Danach können Sie einen neuen Link über die Einstellungsseite anfordern.',
    infoBlockTitle:     'Was passiert als nächstes?',
    ctaLabel:           'E-Mail-Adresse bestätigen',
    footnote:           'Falls Sie kein Used Car Inspector AI-Konto erstellt haben, können Sie diese E-Mail ignorieren. Es sind keine weiteren Schritte erforderlich.',
    textBody:
`Hallo {{name}},

Vielen Dank für die Erstellung Ihres Used Car Inspector AI-Kontos.

Um Ihre E-Mail-Adresse zu bestätigen, besuchen Sie den folgenden Link:
{{url}}

Dieser Link ist {{hours}} Stunden gültig.

Falls Sie kein Konto erstellt haben, ignorieren Sie diese E-Mail bitte.

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },

  mk: {
    subject:            'Потврдете ја вашата е-пошта — Used Car Inspector AI',
    previewText:        'Потврдете ја е-поштата за да го активирате вашиот Used Car Inspector AI налог.',
    eyebrow:            'Верификација на налог',
    headline:           'Потврдете ја вашата е-адреса',
    subheadline:        'Еден клик и сте подготвени да го прегледате вашиот следен автомобил.',
    headerContextLabel: 'Линк за верификација',
    greeting:           'Здраво {{name}},',
    p1:                 'Благодариме за создавањето на Used Car Inspector AI налог. За да ги користите сите функции, ве молиме потврдете ја вашата е-адреса со клик на копчето подолу.',
    p2:                 'Овој линк е важечки <strong style="color:#ffffff;">{{hours}} часа</strong>. После тоа, можете да побарате нов преку страницата за поставки.',
    infoBlockTitle:     'Што се случува следно?',
    ctaLabel:           'Потврди е-адреса',
    footnote:           'Ако не сте создале налог на Used Car Inspector AI, слободно игнорирајте го овој е-маил. Не е потребна никаква акција.',
    textBody:
`Здраво {{name}},

Благодариме за создавањето на Used Car Inspector AI налог.

За да ја потврдите е-адресата, посетете го линкот подолу:
{{url}}

Овој линк е важечки {{hours}} часа.

Ако не сте создале налог, слободно игнорирајте го овој е-маил.

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },

  sq: {
    subject:            'Verifikoni e-mailin tuaj — Used Car Inspector AI',
    previewText:        'Verifikoni e-mailin tuaj për të aktivizuar llogarinë tuaj të Used Car Inspector AI.',
    eyebrow:            'Verifikimi i llogarisë',
    headline:           'Verifikoni adresën tuaj të e-mailit',
    subheadline:        'Një klik dhe jeni gati të inspektoni makinën tuaj të ardhshme.',
    headerContextLabel: 'Lidhja e verifikimit',
    greeting:           'Përshëndetje {{name}},',
    p1:                 'Faleminderit që krijuat një llogari në Used Car Inspector AI. Për të filluar përdorimin e të gjitha funksioneve, ju lutemi verifikoni adresën tuaj të e-mailit duke klikuar butonin më poshtë.',
    p2:                 'Kjo lidhje është e vlefshme për <strong style="color:#ffffff;">{{hours}} orë</strong>. Pas kësaj, mund të kërkoni një të re nga faqja e cilësimeve.',
    infoBlockTitle:     'Çfarë ndodh më pas?',
    ctaLabel:           'Verifiko adresën e e-mailit',
    footnote:           'Nëse nuk keni krijuar një llogari në Used Car Inspector AI, mund ta injoroni këtë e-mail pa problem. Nuk kërkohet asnjë veprim.',
    textBody:
`Përshëndetje {{name}},

Faleminderit që krijuat llogarinë tuaj të Used Car Inspector AI.

Për të verifikuar adresën tuaj të e-mailit, vizitoni lidhjen më poshtë:
{{url}}

Kjo lidhje është e vlefshme për {{hours}} orë.

Nëse nuk keni krijuar një llogari, mund ta injoroni këtë e-mail.

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },
}

export function getVerifyEmailStrings(lang: string | null | undefined): VerifyEmailStrings {
  return verifyEmailTranslations[resolveEmailLang(lang)]
}

// ─── Reset Password ───────────────────────────────────────────────────────────

export interface ResetPasswordStrings {
  subject:            string
  previewText:        string
  eyebrow:            string
  headline:           string
  subheadline:        string
  headerContextLabel: string
  greeting:           string
  p1:                 string
  p2:                 string
  p3:                 string
  infoBlockTitle:     string
  ctaLabel:           string
  footnote:           string
  textBody:           string
}

const resetPasswordTranslations: Record<SupportedLang, ResetPasswordStrings> = {
  en: {
    subject:            'Reset your password — Used Car Inspector AI',
    previewText:        'Reset your Used Car Inspector AI password. This link expires in 1 hour.',
    eyebrow:            'Password Reset',
    headline:           'Reset your password',
    subheadline:        'Follow the link below to set a new password for your account.',
    headerContextLabel: 'Secure Reset Link',
    greeting:           'Hi {{name}},',
    p1:                 'We received a request to reset the password for your Used Car Inspector AI account. Click the button below to choose a new password.',
    p2:                 'This link is valid for <strong style="color:#ffffff;">{{hours}} hour</strong> and can only be used once. If it expires, you can request a new reset link from the login page.',
    p3:                 'If you did not request a password reset, your account is safe — no changes have been made.',
    infoBlockTitle:     'Need help?',
    ctaLabel:           'Reset Password',
    footnote:           'If you didn\'t request a password reset, ignore this email. Your password will not change.',
    textBody:
`Hi {{name}},

We received a request to reset your Used Car Inspector AI password.

To set a new password, visit the link below:
{{url}}

This link is valid for {{hours}} hour and can only be used once.

If you didn't request a password reset, you can safely ignore this email.

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },

  sr: {
    subject:            'Resetujte lozinku — Used Car Inspector AI',
    previewText:        'Resetujte lozinku za Used Car Inspector AI. Ovaj link ističe za 1 sat.',
    eyebrow:            'Resetovanje lozinke',
    headline:           'Resetujte vašu lozinku',
    subheadline:        'Pratite link ispod da biste postavili novu lozinku za vaš nalog.',
    headerContextLabel: 'Sigurni link za resetovanje',
    greeting:           'Zdravo {{name}},',
    p1:                 'Primili smo zahtev za resetovanje lozinke za vaš Used Car Inspector AI nalog. Kliknite na dugme ispod da izaberete novu lozinku.',
    p2:                 'Ovaj link važi <strong style="color:#ffffff;">{{hours}} sat</strong> i može se koristiti samo jednom. Ako istekne, možete zatražiti novi putem stranice za prijavu.',
    p3:                 'Ako niste tražili resetovanje lozinke, vaš nalog je bezbedan — nikakve izmene nisu napravljene.',
    infoBlockTitle:     'Trebate pomoć?',
    ctaLabel:           'Resetuj lozinku',
    footnote:           'Ako niste tražili resetovanje lozinke, ignorišite ovaj e-mail. Vaša lozinka se neće promeniti.',
    textBody:
`Zdravo {{name}},

Primili smo zahtev za resetovanje lozinke za vaš Used Car Inspector AI nalog.

Da biste postavili novu lozinku, posetite link ispod:
{{url}}

Ovaj link važi {{hours}} sat i može se koristiti samo jednom.

Ako niste tražili resetovanje lozinke, slobodno ignorišite ovaj e-mail.

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },

  de: {
    subject:            'Passwort zurücksetzen — Used Car Inspector AI',
    previewText:        'Setzen Sie Ihr Used Car Inspector AI-Passwort zurück. Dieser Link läuft in 1 Stunde ab.',
    eyebrow:            'Passwort zurücksetzen',
    headline:           'Passwort zurücksetzen',
    subheadline:        'Folgen Sie dem Link unten, um ein neues Passwort für Ihr Konto festzulegen.',
    headerContextLabel: 'Sicherer Reset-Link',
    greeting:           'Hallo {{name}},',
    p1:                 'Wir haben eine Anfrage zum Zurücksetzen des Passworts für Ihr Used Car Inspector AI-Konto erhalten. Klicken Sie auf den Button unten, um ein neues Passwort zu wählen.',
    p2:                 'Dieser Link ist <strong style="color:#ffffff;">{{hours}} Stunde</strong> gültig und kann nur einmal verwendet werden. Falls er abläuft, können Sie einen neuen Link über die Anmeldeseite anfordern.',
    p3:                 'Falls Sie kein Zurücksetzen des Passworts beantragt haben, ist Ihr Konto sicher — es wurden keine Änderungen vorgenommen.',
    infoBlockTitle:     'Brauchen Sie Hilfe?',
    ctaLabel:           'Passwort zurücksetzen',
    footnote:           'Falls Sie kein Zurücksetzen des Passworts beantragt haben, ignorieren Sie diese E-Mail. Ihr Passwort wird nicht geändert.',
    textBody:
`Hallo {{name}},

Wir haben eine Anfrage zum Zurücksetzen Ihres Used Car Inspector AI-Passworts erhalten.

Um ein neues Passwort festzulegen, besuchen Sie den folgenden Link:
{{url}}

Dieser Link ist {{hours}} Stunde gültig und kann nur einmal verwendet werden.

Falls Sie kein Zurücksetzen beantragt haben, ignorieren Sie diese E-Mail bitte.

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },

  mk: {
    subject:            'Ресетирајте ја лозинката — Used Car Inspector AI',
    previewText:        'Ресетирајте ја лозинката за Used Car Inspector AI. Овој линк истекува за 1 час.',
    eyebrow:            'Ресетирање лозинка',
    headline:           'Ресетирајте ја лозинката',
    subheadline:        'Следете го линкот подолу за да поставите нова лозинка за вашиот налог.',
    headerContextLabel: 'Безбеден линк за ресетирање',
    greeting:           'Здраво {{name}},',
    p1:                 'Примивме барање за ресетирање на лозинката за вашиот Used Car Inspector AI налог. Кликнете на копчето подолу за да изберете нова лозинка.',
    p2:                 'Овој линк е важечки <strong style="color:#ffffff;">{{hours}} час</strong> и може да се користи само еднаш. Ако истече, можете да побарате нов преку страницата за најавување.',
    p3:                 'Ако не сте барале ресетирање на лозинката, вашиот налог е безбеден — не се направени никакви промени.',
    infoBlockTitle:     'Потребна ви е помош?',
    ctaLabel:           'Ресетирај лозинка',
    footnote:           'Ако не сте барале ресетирање на лозинката, игнорирајте го овој е-маил. Вашата лозинка нема да се промени.',
    textBody:
`Здраво {{name}},

Примивме барање за ресетирање на лозинката за вашиот Used Car Inspector AI налог.

За да поставите нова лозинка, посетете го линкот подолу:
{{url}}

Овој линк е важечки {{hours}} час и може да се користи само еднаш.

Ако не сте барале ресетирање, слободно игнорирајте го овој е-маил.

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },

  sq: {
    subject:            'Rivendosni fjalëkalimin — Used Car Inspector AI',
    previewText:        'Rivendosni fjalëkalimin tuaj të Used Car Inspector AI. Kjo lidhje skadon në 1 orë.',
    eyebrow:            'Rivendosja e fjalëkalimit',
    headline:           'Rivendosni fjalëkalimin tuaj',
    subheadline:        'Ndiqni lidhjen më poshtë për të vendosur një fjalëkalim të ri për llogarinë tuaj.',
    headerContextLabel: 'Lidhja e sigurt e rivendosjes',
    greeting:           'Përshëndetje {{name}},',
    p1:                 'Morëm një kërkesë për rivendosjen e fjalëkalimit të llogarisë suaj të Used Car Inspector AI. Klikoni butonin më poshtë për të zgjedhur një fjalëkalim të ri.',
    p2:                 'Kjo lidhje është e vlefshme për <strong style="color:#ffffff;">{{hours}} orë</strong> dhe mund të përdoret vetëm një herë. Nëse skadon, mund të kërkoni një të re nga faqja e hyrjes.',
    p3:                 'Nëse nuk keni kërkuar rivendosjen e fjalëkalimit, llogaria juaj është e sigurt — nuk janë bërë ndryshime.',
    infoBlockTitle:     'Keni nevojë për ndihmë?',
    ctaLabel:           'Rivendos fjalëkalimin',
    footnote:           'Nëse nuk keni kërkuar rivendosjen e fjalëkalimit, injoroni këtë e-mail. Fjalëkalimi juaj nuk do të ndryshojë.',
    textBody:
`Përshëndetje {{name}},

Morëm një kërkesë për rivendosjen e fjalëkalimit tuaj të Used Car Inspector AI.

Për të vendosur një fjalëkalim të ri, vizitoni lidhjen më poshtë:
{{url}}

Kjo lidhje është e vlefshme për {{hours}} orë dhe mund të përdoret vetëm një herë.

Nëse nuk keni kërkuar rivendosjen, mund ta injoroni këtë e-mail.

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },
}

export function getResetPasswordStrings(lang: string | null | undefined): ResetPasswordStrings {
  return resetPasswordTranslations[resolveEmailLang(lang)]
}

// ─── App Update ───────────────────────────────────────────────────────────────

export interface AppUpdateStrings {
  subject:     string
  previewText: string
  eyebrow:     string
  headline:    string
  subheadline: string
  ctaLabel:    string
  textBody:    string
}

const appUpdateTranslations: Record<SupportedLang, AppUpdateStrings> = {
  en: {
    subject:     'What\'s new in Used Car Inspector AI',
    previewText: 'Discover the latest improvements to your AI car inspection experience.',
    eyebrow:     'App Update',
    headline:    'We\'ve been busy improving your experience',
    subheadline: 'New features and improvements are now live.',
    ctaLabel:    'Explore What\'s New',
    textBody:
`We've rolled out improvements to Used Car Inspector AI.

See what's new: {{url}}

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },

  sr: {
    subject:     'Šta je novo u Used Car Inspector AI',
    previewText: 'Otkrijte najnovija poboljšanja vašeg AI iskustva inspekcije automobila.',
    eyebrow:     'Ažuriranje aplikacije',
    headline:    'Radili smo na poboljšanju vašeg iskustva',
    subheadline: 'Nove funkcije i poboljšanja su sada dostupna.',
    ctaLabel:    'Istražite šta je novo',
    textBody:
`Uveli smo poboljšanja u Used Car Inspector AI.

Pogledajte šta je novo: {{url}}

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },

  de: {
    subject:     'Was gibt es Neues in Used Car Inspector AI',
    previewText: 'Entdecken Sie die neuesten Verbesserungen Ihres KI-Fahrzeuginspektionserlebnisses.',
    eyebrow:     'App-Update',
    headline:    'Wir haben fleißig an Ihrem Erlebnis gearbeitet',
    subheadline: 'Neue Funktionen und Verbesserungen sind jetzt verfügbar.',
    ctaLabel:    'Neuheiten entdecken',
    textBody:
`Wir haben Verbesserungen an Used Car Inspector AI eingeführt.

Sehen Sie, was neu ist: {{url}}

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },

  mk: {
    subject:     'Што е ново во Used Car Inspector AI',
    previewText: 'Откријте ги најновите подобрувања на вашето AI искуство за инспекција на автомобили.',
    eyebrow:     'Ажурирање на апликацијата',
    headline:    'Работевме на подобрување на вашето искуство',
    subheadline: 'Нови функции и подобрувања се сега достапни.',
    ctaLabel:    'Истражете ги новостите',
    textBody:
`Воведовме подобрувања во Used Car Inspector AI.

Погледнете што е ново: {{url}}

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },

  sq: {
    subject:     'Çfarë është e re në Used Car Inspector AI',
    previewText: 'Zbuloni përmirësimet më të fundit të përvojës suaj të inspektimit të makinave me AI.',
    eyebrow:     'Përditësim i aplikacionit',
    headline:    'Kemi punuar shumë për të përmirësuar përvojën tuaj',
    subheadline: 'Funksione dhe përmirësime të reja janë tani të disponueshme.',
    ctaLabel:    'Eksploroni të rejat',
    textBody:
`Kemi prezantuar përmirësime në Used Car Inspector AI.

Shikoni çfarë është e re: {{url}}

— Used Car Inspector AI
support@usedcarsdoctor.com`,
  },
}

export function getAppUpdateStrings(lang: string | null | undefined): AppUpdateStrings {
  return appUpdateTranslations[resolveEmailLang(lang)]
}
