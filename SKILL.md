---
name: nyq-miniprogram
description: Build and polish the Ning Yue Qiu WeChat Mini Program. Use when working in this repository on mini program pages, WXML/WXSS/JS components, backend API contracts, login/payment/order flows, venue partner workflows, launch readiness, and Codex handoff documentation.
---

# Ning Yue Qiu Mini Program

Use this project skill when improving this repository.

The default product target is a WeChat Mini Program, not Android, APK, Capacitor, or a polished H5 wrapper.

## Workflow

1. Read `WORKSPACE_SCOPE.md`, `README.md`, and the target `miniprogram/` files before editing.
2. Put new front-end product work in `miniprogram/`.
3. Treat `site/` only as legacy reference for business flow, copy, and visual direction.
4. Preserve API routes, auth/session intent, database fields, order state, venue workflows, and payment assumptions unless the user explicitly changes them.
5. Verify mini program pages structurally: page registration in `app.json`, matching `.wxml/.wxss/.js/.json`, no browser-only APIs, and no broken route names.

## Product Direction

宁约球 is a campus sports booking and matchmaking mini program for users, venues, and operations staff.

The UI should feel:

- Young, athletic, green, trustworthy, and practical.
- Native to WeChat Mini Program interaction patterns.
- Clear enough for booking, order, venue, payment, check-in, and admin workflows.
- Fast to scan on phone screens without feeling like a squeezed website.

Read `docs/snapsport-c-prd.md` before substantial product work.

## Constraints

- Do not add or restore Android, APK, Capacitor, emulator, or native app work unless the user explicitly reopens that direction.
- Do not make `site/` the main development surface.
- Do not use browser-only APIs in mini program pages. Use `wx.request`, `wx.navigateTo`, `wx.switchTab`, and `wx.setStorageSync` patterns.
- Keep Chinese labels short and readable on phone screens.
- Keep core workflows visible: find venue, book slot, join game, create game, orders/check-in, messages, profile.
- For launch planning, prioritize WeChat login, real HTTPS backend, payment state flow, venue-side workflow, privacy terms, and audit compliance.
