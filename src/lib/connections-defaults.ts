import { ConnectedSource, ListeningFeed } from "@/types/connections";

export const defaultSources: ConnectedSource[] = [
  { id: "linkedin", name: "LinkedIn", storageKeyPrefix: "arc:linkedin", status: "Connected", lastSync: null },
  { id: "instagram", name: "Instagram", storageKeyPrefix: "arc:instagram", status: "Connected", lastSync: null },
  { id: "twitter", name: "Twitter / X", storageKeyPrefix: "arc:twitter", status: "Connected", lastSync: null },
  { id: "whatsapp", name: "WhatsApp Business", storageKeyPrefix: "arc:whatsapp", status: "Connected", lastSync: null },
  { id: "gcal", name: "Google Calendar", storageKeyPrefix: "arc:gcal", status: "Not Connected", lastSync: null },
  { id: "ga", name: "Google Analytics", storageKeyPrefix: "arc:ga", status: "Not Connected", lastSync: null },
];

export const defaultFeeds: ListeningFeed[] = [
  {
    id: "f1",
    name: "LinkedIn #solofounder",
    type: "Social Hashtag",
    url: "",
    status: "Active",
    notes: "Track solo founder content themes, pain points, and engagement patterns",
  },
  {
    id: "f2",
    name: "LinkedIn #smallbusiness India",
    type: "Social Hashtag",
    url: "",
    status: "Active",
    notes: "Indian SMB owners talking about growth challenges and tools",
  },
  {
    id: "f3",
    name: "Reddit r/IndianStartups",
    type: "Forum",
    url: "https://reddit.com/r/IndianStartups",
    status: "Active",
    notes: "Monitor for lead gen discussions, WhatsApp automation mentions, sales pain points",
  },
  {
    id: "f4",
    name: "Google Alerts: AI sales automation India",
    type: "News Alert",
    url: "",
    status: "Active",
    notes: "Track news coverage and competitor moves in the AI sales space",
  },
  {
    id: "f5",
    name: "IndiaMART coaching institutes",
    type: "Marketplace",
    url: "",
    status: "Active",
    notes: "Identify coaching academies that could benefit from WhatsApp lead capture",
  },
];
