import app from "../src/app.js";

export const config = {
  api: {
    // Let Express handle parsing for json/urlencoded/text and sendBeacon payloads.
    bodyParser: false,
  },
};

export default function handler(req, res) {
  return app(req, res);
}
import app from "../src/app.js";
export const config = {
    api: {
        // Let Express handle parsing for json/urlencoded/text and sendBeacon payloads.
        bodyParser: false,
    },
};
export default function handler(req, res) {
    return app(req, res);
}
