export interface EmailCardItem {
  icon: string
  title: string
  description: string
}

export interface BaseEmailTemplateProps {
  previewText: string
  eyebrow?: string
  headline: string
  subheadline?: string
  bodyContent: string
  ctaLabel: string
  ctaUrl: string
  footnote?: string
  supportEmail?: string
  cards?: EmailCardItem[]
  secondaryTitle?: string
  secondaryBody?: string
  secondaryCtaLabel?: string
  secondaryCtaUrl?: string
}

export interface AppAnnouncementContent {
  campaignName:      string
  subject:           string
  previewText:       string
  eyebrow:           string
  headline:          string
  subheadline:       string
  introBody:         string
  ctaLabel:          string
  ctaUrl:            string
  card1Icon:         string
  card1Title:        string
  card1Description:  string
  card2Icon:         string
  card2Title:        string
  card2Description:  string
  card3Icon:         string
  card3Title:        string
  card3Description:  string
  card4Icon:         string
  card4Title:        string
  card4Description:  string
  infoBlockTitle:    string
  infoBlockBody:     string
  secondaryTitle:    string
  secondaryBody:     string
  secondaryCtaLabel: string
  secondaryCtaUrl:   string
  footnote:          string
  footerLinkLabel:   string
  footerLinkUrl:     string
  signatureLine:     string
}

export interface VerifyEmailTemplateProps {
  name: string
  verifyUrl: string
  lang?: string | null
  expiresInHours?: number
}

export interface ResetPasswordTemplateProps {
  name: string
  resetUrl: string
  lang?: string | null
  expiresInHours?: number
}

export interface AppUpdateTemplateProps {
  ctaUrl: string
  lang?: string | null
  previewText?: string
}

export interface MarketingCampaignContent {
  campaignName:      string
  subject:           string
  previewText:       string
  headline:          string
  introParagraph:    string
  ctaLabel:          string
  ctaUrl:            string
  value1:            string
  value2:            string
  value3:            string
  trustParagraph:    string
  secondaryCtaLabel: string
  secondaryCtaUrl:   string
  footerNote:        string
}
