import fs from "fs";
import fetch from "node-fetch";

const url = "https://np.ironhelmet.com/trequest_game/";
let authToken = null;
try {
	authToken = fs.existsSync("./auth.txt") ? fs.readFileSync("./auth.txt", "utf-8").trim() : fs.readFileSync("../auth.txt", "utf-8").trim();
} catch (e) {}

if (!authToken) {
	console.log(`Please create a file named "auth.txt" in the root directory and paste your auth token in it.`);
	console.log(
		`You can get your auth token by logging into Neptune's Pride, opening the developer console, and running "(await cookieStore.get("auth")).value".`
	);

	process.exit(1);
}

async function request<T>(endpoint: string, params: Record<string, string | number> = {}) {
	params["type"] = endpoint;
	params["game_number"] = "6321260417777664";
	params["version"] = "";

	let paramsString = "?";
	for (const key in params) {
		paramsString += `${key}=${params[key]}&`;
	}
	const req = await fetch(`${url}${endpoint}${paramsString}`, {
		method: "POST",
		headers: {
			cookie: `auth=${authToken}`
		}
	});

	return (await req.json()) as T;
}

interface Message {
	status: string;
	group: string;
	created: string;
	commentCount: number;
	key: string;
	activity: string;
	payload: {
		body: string;
		to_uids: string;
		to_colors: string;
		to_aliases: string;
		from_color: string;
		from_uid: number;
		from_alias: string;
		subject: string;
	};
}

interface Comment {
	body: string;
	player_uid: number;
	key: string;
	created: string;
}

interface FetchGameMessagesResult {
	event: "message:new_messages";
	report: {
		messages: Message[];
	};
}

interface FetchGameMessageCommentsResult {
	event: "message:new_comments";
	report: {
		message_key: string;
		messages: Comment[];
	};
}

type Thread = { initialMessage: Message; comments: Comment[] };

async function run() {
	const messages = await request<FetchGameMessagesResult>("fetch_game_messages", { count: 1000, offset: 0, group: "game_diplomacy" });

	const threads: Promise<Thread>[] = messages.report.messages.map(async message => {
		const comments = await request<FetchGameMessageCommentsResult>("fetch_game_message_comments", { message_key: message.key, count: 1000, offset: 0 });
		return { initialMessage: message, comments: comments.report.messages };
	});

	const resolvedThreads = await Promise.all(threads);
	fs.writeFileSync("./result.json", JSON.stringify(resolvedThreads, null, 2));
	createHistoryFiles("./history");
}

async function createHistoryFiles(dir: string) {
	const threads = JSON.parse(fs.readFileSync("./result.json", "utf-8")) as Thread[];
	if (!fs.existsSync(dir)) fs.mkdirSync(dir);
	fs.readdirSync(dir).forEach(file => fs.unlinkSync(`${dir}/${file}`));

	const members: string[] = [];
	threads.forEach(thread => {
		members[thread.initialMessage.payload.from_uid] = thread.initialMessage.payload.from_alias;
		const toUids = thread.initialMessage.payload.to_uids.split(",").map(uid => parseInt(uid));
		const toAliases = thread.initialMessage.payload.to_aliases.split(",");

		toUids.forEach((uid, i) => {
			members[uid] = toAliases[i];
		});
	});

	function formatNpString(str: string) {
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
}

run();
