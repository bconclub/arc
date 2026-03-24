import { ChannelMetrics } from "@/types/overview";

export const defaultLinkedIn: ChannelMetrics = {
  followers: { label: "Followers", value: "0" },
  posts: { label: "Posts This Week", value: "0" },
  impressions: { label: "Impressions", value: "0" },
  engagement: { label: "Engagement Rate", value: "0%" },
  dms: { label: "DMs Received", value: "0" },
};

export const defaultInstagram: ChannelMetrics = {
  followers: { label: "Followers", value: "0" },
  posts: { label: "Posts This Week", value: "0" },
  reach: { label: "Reach", value: "0" },
  engagement: { label: "Engagement Rate", value: "0%" },
  dms: { label: "DMs Received", value: "0" },
};

export const defaultTwitter: ChannelMetrics = {
  followers: { label: "Followers", value: "0" },
  posts: { label: "Posts This Week", value: "0" },
  impressions: { label: "Impressions", value: "0" },
  engagement: { label: "Engagement Rate", value: "0%" },
  dms: { label: "DMs Received", value: "0" },
};

export const defaultSalesPipeline: ChannelMetrics = {
  demosBooked: { label: "Demos Booked", value: "0" },
  demosCompleted: { label: "Demos Completed", value: "0" },
  proposalsSent: { label: "Proposals Sent", value: "0" },
  dealsClosed: { label: "Deals Closed", value: "0" },
  revenue: { label: "Revenue", value: "₹0" },
  pipeline: { label: "Active Pipeline Value", value: "₹0" },
};

export const defaultWhatsApp: ChannelMetrics = {
  messagesSent: { label: "Messages Sent", value: "0" },
  repliesReceived: { label: "Replies Received", value: "0" },
  responseRate: { label: "Response Rate", value: "0%" },
  demosBooked: { label: "Demos Booked", value: "0" },
};
