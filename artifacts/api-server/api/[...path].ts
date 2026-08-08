import app from "../src/app.js";

export const config = {
  api: {
    // Let Express handle parsing for json/urlencoded/text and sendBeacon payloads.
    bodyParser: false,
  },
};

export default function handler(req: any, res: any) {
  return (app as unknown as (req: any, res: any) => unknown)(req, res);
}
