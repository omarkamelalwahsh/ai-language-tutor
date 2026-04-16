const { extractOptions } = require('./src/lib/utils');

const item = {
    "id": "f2b89b34-5803-4b70-85a3-9fcc22b994b4",
    "prompt": "What time does the library close on Saturday?",
    "answer_key": {
      "options": [
        "1.00",
        "4.00",
        "10.00",
        "5.00"
      ],
      "correct_index": 0
    }
};

const options1 = extractOptions(item.options || item.answer_key);
console.log("Test 1 (item.options || item.answer_key):", options1);

const options2 = extractOptions((item.options && item.options.length > 0) ? item.options : item.answer_key);
console.log("Test 2 (robust check):", options2);

const itemWithEmptyArr = { ...item, options: [] };
const options3 = extractOptions(itemWithEmptyArr.options || itemWithEmptyArr.answer_key);
console.log("Test 3 (empty options || answer_key):", options3);

const options4 = extractOptions((itemWithEmptyArr.options && itemWithEmptyArr.options.length > 0) ? itemWithEmptyArr.options : itemWithEmptyArr.answer_key);
console.log("Test 4 (robust check with empty options):", options4);
