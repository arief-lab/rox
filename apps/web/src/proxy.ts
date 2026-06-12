// SPDX-License-Identifier: AGPL-3.0-or-later
import { evlogMiddleware } from "evlog/next";

export const proxy = evlogMiddleware();

export const config = {
  matcher: ["/api/:path*"],
};
