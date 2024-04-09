var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import fs from "fs";
import fetch from "node-fetch";
const url = "https://np.ironhelmet.com/trequest_game/";
let authToken = null;
try {
    authToken = fs.existsSync("./auth.txt") ? fs.readFileSync("./auth.txt", "utf-8").trim() : fs.readFileSync("../auth.txt", "utf-8").trim();
}
catch (e) { }
if (!authToken) {
    console.log(`Please create a file named "auth.txt" in the root directory and paste your auth token in it.`);
    console.log(`You can get your auth token by logging into Neptune's Pride, opening the developer console, and running "(await cookieStore.get("auth")).value".`);
    process.exit(1);
}
function request(endpoint, params = {}) {
    return __awaiter(this, void 0, void 0, function* () {
        params["type"] = endpoint;
        params["game_number"] = "6321260417777664";
        params["version"] = "";
        let paramsString = "?";
        for (const key in params) {
            paramsString += `${key}=${params[key]}&`;
        }
        const req = yield fetch(`${url}${endpoint}${paramsString}`, {
            method: "POST",
            headers: {
                cookie: `auth=${authToken}`
            }
        });
        return (yield req.json());
    });
}
function run() {
    return __awaiter(this, void 0, void 0, function* () {
        const messages = yield request("fetch_game_messages", { count: 1000, offset: 0, group: "game_diplomacy" });
        const threads = messages.report.messages.map((message) => __awaiter(this, void 0, void 0, function* () {
            const comments = yield request("fetch_game_message_comments", { message_key: message.key, count: 1000, offset: 0 });
            return { initialMessage: message, comments: comments.report.messages };
        }));
        const resolvedThreads = yield Promise.all(threads);
        fs.writeFileSync("./result.json", JSON.stringify(resolvedThreads, null, 2));
        createHistoryFiles("./history");
    });
}
function createHistoryFiles(dir) {
    return __awaiter(this, void 0, void 0, function* () {
        const threads = JSON.parse(fs.readFileSync("./result.json", "utf-8"));
        if (!fs.existsSync(dir))
            fs.mkdirSync(dir);
        fs.readdirSync(dir).forEach(file => fs.unlinkSync(`${dir}/${file}`));
        const members = [];
        threads.forEach(thread => {
            members[thread.initialMessage.payload.from_uid] = thread.initialMessage.payload.from_alias;
            const toUids = thread.initialMessage.payload.to_uids.split(",").map(uid => parseInt(uid));
            const toAliases = thread.initialMessage.payload.to_aliases.split(",");
            toUids.forEach((uid, i) => {
                members[uid] = toAliases[i];
            });
        });
        function formatNpString(str) {
            const replaceMap = {
                "<br>": "\n",
                "&#x27;": "'",
                "&#x22;": '"',
                "&lt;": "<",
                "&gt;": ">",
                "&amp;": "&",
                "&quot;": '"',
                "&apos;": "'",
                "&#x2F;": "/"
            };
            members.forEach((member, i) => {
                replaceMap[`[[${i}]]`] = member;
            });
            for (const key in replaceMap) {
                str = str.replaceAll(key, replaceMap[key]);
            }
            return str.trim();
        }
        threads.forEach(thread => {
            const fPath = `${dir}/${thread.initialMessage.payload.subject}.txt`;
            let text = ``;
            text += `Subject: ${formatNpString(thread.initialMessage.payload.subject)}\n`;
            text += `From: ${members[thread.initialMessage.payload.from_uid]}\n`;
            const toNames = thread.initialMessage.payload.to_uids.split(",").map(uid => members[parseInt(uid)]);
            text += `To: ${toNames.join(", ")}\n`;
            text += `Date: ${thread.initialMessage.created}\n\n`;
            text += `${formatNpString(thread.initialMessage.payload.body)}\n\n`;
            thread.comments.reverse().forEach(comment => {
                text += `From: ${members[comment.player_uid]} \n${formatNpString(comment.body)}\n\n`;
            });
            fs.writeFileSync(fPath, text);
        });
    });
}
run();
