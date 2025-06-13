---
layout: default
title: Resume
permalink: /resume/
---

# [James Fischer](/)

**San Francisco, CA • (949) 433-1013 • contact@jamesfischer.dev**

## Experience

### Academia.edu • *San Francisco, CA*

**Senior Engineering Manager**
*July 2024 - Present* <span id="current-role-duration"></span>

Lead a group of 19 engineers across four subscription product teams—payments, churn, marketing, and new products.

- Scaled the Premium org from 8 → 19 engineers, adding a management layer and using DORA delivery metrics to surface and resolve process bottlenecks
- Hired one EM and promoted another while continuing to manage one team of 3 engineers directly
- Grew subscription net receipts 24% YoY in Q1 2025 despite declining SEO traffic
- Added installment billing, lifting payment success rate 15%
- Rolled out researcher & professional pricing tiers, adding $482K ARR
- Boosted cancellation-flow save rate 21% with a values-based open-access message
- Cut Change Lead Time from ~4 days to < 2 days by tightening review processes

**Engineering Manager**
*June 2021 - July 2024* (3 yrs 1 mo)

Managed 7–9 engineers across ~2 teams at a time. Teams included paper recommendations, revenue growth (checkout, pricing, value-prop testing), user-uploaded document display on the web, and social engagement (news feed, following recommendations).

- Saved $1.12M/yr by replacing an expensive, old user-uploaded-document-to-HTML system (93% cost reduction)
- Boosted related content sidebar CTR by 33% by replacing TF-IDF system with vector similarity
- Sponsored a self-serve pricing test tool that made it so easy for us to run pricing tests that we found a $100K/month win from an aggressive price point we hadn't planned to try
- Defined our Staff Software Engineer level and promoted its first member

**Senior Software Engineer**
*June 2020 - June 2021* (1 yr)

Tech lead for our initial foray into open access publishing, Academia Letters. Built our manuscript tracking and rendering systems.

**Software Engineer**
*May 2018 - June 2020* (2 yrs 1 mo)

Worked on product growth initiatives, especially email marketing. Did some time on SRE and helped upgrade our monolith to Rails 5.

### FileYourTaxes.com • *Oxnard, CA*

**Software Engineer**
*August 2015 - May 2018* (2 yrs 9 mos)

Kept our personal income tax engine up to date for many state tax regulations. Added bulk tools for professional tax preparers.

## Skills

Technical planning • Cross-functional collaboration • A/B testing • AI • Product engineering

## Education

**Lewis & Clark College** • *Portland, OR*  
Bachelor of Arts, Computer Science • *May 2018*

<script>
function updateCurrentRoleDuration() {
  const startDate = new Date('2024-07-01');
  const currentDate = new Date();

  const diffTime = Math.abs(currentDate - startDate);
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const years = Math.floor(diffDays / 365);
  const months = Math.floor((diffDays % 365) / 30);

  let duration;
  if (years > 0 && months > 0) {
    duration = `(${years} yr${years > 1 ? 's' : ''} ${months} mo${months > 1 ? 's' : ''})`;
  } else if (years > 0) {
    duration = `(${years} yr${years > 1 ? 's' : ''})`;
  } else {
    duration = `(${months} mo${months > 1 ? 's' : ''})`;
  }

  const element = document.getElementById('current-role-duration');
  if (element) {
    element.textContent = duration;
  }
}

// Update on page load
document.addEventListener('DOMContentLoaded', updateCurrentRoleDuration);
</script>
