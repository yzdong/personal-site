"""Build run-interactions.png — stacked bar of in-run Op↔Cop messages per hour.

Uses the 99-message locked classification (5 categories).
Color palette matches the roles.png diagram aesthetic.
"""
import json
from collections import defaultdict
from datetime import datetime, timedelta, timezone
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.patches import Patch

# Colors keyed to routing destination (same palette as roles.png)
CATS = [
    ("Translate-to-Agent",        "① Translate to Agent",        "#7BC4A8"),  # → Agent
    ("Approve-Agent-decision",    "② Approve Agent decision",    "#3A8A6F"),  # → Agent
    ("Investigate-Agent",         "③ Investigate Agent",         "#333333"),  # → Op
    ("Explain-domain",            "④ Explain domain",            "#999999"),  # → Op
    ("Act-locally",               "⑤ Experiment notetaking & ops","#A04068"), # Cop only
]

# Load messages
data = json.load(open('/Users/zidong/personal/personal-site/scripts/crux-land-copilot-messages.json'))
in_run = [m for m in data if m.get('final')]
print(f"In-run total: {len(in_run)}")

# Bucket by PT hour as NAIVE datetimes (matplotlib date formatters don't carry tz)
PT = timezone(timedelta(hours=-7))  # PDT during the run window
buckets = defaultdict(lambda: defaultdict(int))
for m in in_run:
    ts_utc = datetime.fromisoformat(m['timestamp'].replace('Z', '+00:00'))
    ts_pt = ts_utc.astimezone(PT)
    # strip tz for matplotlib axis labelling consistency
    hour = ts_pt.replace(minute=0, second=0, microsecond=0, tzinfo=None)
    buckets[hour][m['category']] += 1

# Build the full hourly x-axis spanning the run window
all_hours = sorted(buckets.keys())
start = all_hours[0]
end = all_hours[-1] + timedelta(hours=1)
x_hours = []
cur = start
while cur < end:
    x_hours.append(cur)
    cur += timedelta(hours=1)

# Compute stacks
stacks = {cat: [buckets[h][cat] for h in x_hours] for cat, _, _ in CATS}

# Get count for legend labels
totals = {cat: sum(stacks[cat]) for cat, _, _ in CATS}

# === Render ===
fig, ax = plt.subplots(figsize=(14.8, 5.8))

# Stacked bars
bar_width = 1.0 / 24  # 1 hour as fraction of a day, since x is matplotlib datenum
bottom = [0] * len(x_hours)
for cat, label, color in CATS:
    heights = stacks[cat]
    ax.bar([mdates.date2num(h) for h in x_hours],
           heights, width=bar_width, bottom=bottom,
           color=color, edgecolor='none', align='edge', label=label)
    bottom = [b + h for b, h in zip(bottom, heights)]

# Title + subtitle
fig.suptitle("What I talked to the Copilot about, hour by hour",
             fontsize=15, fontweight='bold', y=1.00)
fig.text(0.5, 0.95,
         "99 Operator → Copilot messages during the CRUX-Land run, by category.",
         ha='center', fontsize=10.5, color='#666', style='italic')

# Axes
ax.set_ylabel("Messages per hour (PT)", fontsize=10, color='#333')
ax.set_ylim(0, 22)
ax.set_yticks([0, 5, 10, 15, 20])
ax.grid(axis='y', alpha=0.3, linewidth=0.7, linestyle='-')
ax.set_axisbelow(True)

# x-axis: show day boundaries
ax.xaxis.set_major_locator(mdates.DayLocator())
ax.xaxis.set_major_formatter(mdates.DateFormatter('%b %-d'))
ax.xaxis.set_minor_locator(mdates.HourLocator(byhour=[6, 12, 18]))
ax.tick_params(axis='x', labelsize=9, colors='#333')
ax.tick_params(axis='y', labelsize=9, colors='#333')

# Hide top/right spines, soften the others
for sp in ['top', 'right']:
    ax.spines[sp].set_visible(False)
for sp in ['left', 'bottom']:
    ax.spines[sp].set_color('#999')
    ax.spines[sp].set_linewidth(0.8)

# Set xlim from start of first day to midnight after the last data hour
x_left = start.replace(hour=0)
last_hour = all_hours[-1]
# round up to next midnight
x_right = (last_hour + timedelta(days=1)).replace(hour=0)
ax.set_xlim(mdates.date2num(x_left), mdates.date2num(x_right))

# === Annotations: event lines ===
def annotate(time_pt, label, line_y=18, label_y=20.5):
    x = mdates.date2num(time_pt)
    ax.axvline(x=x, ymin=0, ymax=(line_y / 22), color='#888',
               linewidth=0.8, linestyle='-', alpha=0.6, zorder=0)
    ax.annotate(label, xy=(x, label_y), ha='center', fontsize=8.5,
                color='#333', fontweight='bold')

# Annotations use naive PT datetimes
annotate(datetime(2026, 4, 29, 15, 0),
         "Why is the Agent burning\nso much money?")
annotate(datetime(2026, 4, 30, 17, 0),
         "Operator goes offline;\npre-bid wired")
annotate(datetime(2026, 5, 4, 11, 0),
         "Operator back online;\nbid-day decisions")

# === Legend (right side, with counts) ===
legend_handles = [Patch(facecolor=color, label=f"{label} ({totals[cat]})")
                  for cat, label, color in CATS]
ax.legend(handles=legend_handles, loc='upper right',
          fontsize=9, frameon=True, framealpha=0.95,
          edgecolor='#e2e2e2', title="Categories",
          title_fontsize=9.5, labelspacing=0.7)

plt.subplots_adjust(top=0.88, bottom=0.10, left=0.06, right=0.98)
out = '/Users/zidong/personal/personal-site/public/images/crux-land/run-interactions.png'
plt.savefig(out, dpi=160, facecolor='white', bbox_inches='tight')
plt.close()
print(f"wrote {out}")
