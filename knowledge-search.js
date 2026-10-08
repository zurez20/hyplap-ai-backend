// node knowledge-search.js "refund policy"  

// searchKnowledge(query): Reads all .txt files in ./knowledge, scores each file by how many query words it contains, and returns them sorted by score.

// CLI execution block: Reads your terminal input, calls searchKnowledge(), and logs the top 5 highest-scoring files.

// import fs from "fs/promises";
// import path from "path";

// const knowledgeDir = path.join(process.cwd(), "knowledge");

// async function searchKnowledge(query) {
//     const files = await fs.readdir(knowledgeDir);

//     const words = query
//         .toLowerCase()
//         .split(/\s+/)
//         .filter((word) => word.length > 2);

//     const results = [];

//     for (const file of files) {
//         if (!file.endsWith(".txt")) continue;

//         const filePath = path.join(knowledgeDir, file);
//         const content = await fs.readFile(filePath, "utf8");

//         const lowerContent = content.toLowerCase();

//         let score = 0;

//         for (const word of words) {
//             if (lowerContent.includes(word)) {
//                 score++;
//             }
//         }

//         if (score > 0) {
//             results.push({
//                 file,
//                 score,
//             });
//         }
//     }

//     results.sort((a, b) => b.score - a.score);

//     return results;
// }

// const query = process.argv.slice(2).join(" ");

// if (!query) {
//     console.log("Please provide a search query.");
//     process.exit(1);
// }

// const results = await searchKnowledge(query);

// console.log("\nRelevant files:\n");

// for (const result of results.slice(0, 5)) {
//     console.log(`${result.file}  → score: ${result.score}`);
// }