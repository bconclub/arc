"use client";

import { ChannelMetrics } from "@/types/overview";

function num(val: string): number {
  return parseFloat(val.replace(/[^0-9.-]/g, "")) || 0;
}

interface SummaryBarProps {
  linkedin: ChannelMetrics;
  instagram: ChannelMetrics;
  twitter: ChannelMetrics;
  sales: ChannelMetrics;
}

export function SummaryBar({ linkedin, instagram, twitter, sales }: SummaryBarProps) {
  const totalReach =
    num(linkedin.impressions?.value ?? "0") +
    num(instagram.reach?.value ?? "0") +
    num(twitter.impressions?.value ?? "0");

  const totalPosts =
    num(linkedin.posts?.value ?? "0") +
    num(instagram.posts?.value ?? "0") +
    num(twitter.posts?.value ?? "0");

  const demosBooked = num(sales.demosBooked?.value ?? "0");
  const demosCompleted = num(sales.demosCompleted?.value ?? "0");
  const dealsClosed = num(sales.dealsClosed?.value ?? "0");
  const closeRate = demosCompleted > 0 ? Math.round((dealsClosed / demosCompleted) * 100) : 0;

  const items = [
    { label: "Total Reach", value: totalReach.toLocaleString() },
    { label: "Posts This Week", value: totalPosts.toString() },
    { label: "Demos Booked", value: demosBooked.toString() },
    { label: "Close Rate", value: `${closeRate}%` },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
      {items.map((item) => (
        <div key={item.label} className="card p-5 text-center">
          <span className="text-3xl sm:text-4xl font-bold font-mono text-text tracking-tighter block leading-none">
            {item.value}
          </span>
          <span className="text-[10px] uppercase tracking-widest text-text-muted mt-2.5 block font-medium">
            {item.label}
          </span>
        </div>
      ))}
    </div>
  );
}
