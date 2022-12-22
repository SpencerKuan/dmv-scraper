const puppeteer = require('puppeteer')
const fs = require('fs');

const settings = {
    tabs: 10,
    link: "https://online.dmv.alaska.gov/knowledgetest"
};

let questionNames = new Set();
let questions = [];
let browser;

init();

async function main() {
    try {
        console.log("running!");
        await run();
    } catch (e) {
        console.log("crashed!!");
        console.error(e);
        save(questions);

        main();
    }
}

async function init(){
    await load();

    // create the browser
    console.log("launching")
    browser = await puppeteer.launch({
        headless: false
    });

    // launch the async scrapers
    for(var i = 0; i < settings.tabs; i ++) main();
}


async function load(){
    await fs.readFile("./data.json", (err, res) => {
        questions = JSON.parse(res);
        questionNames = new Set(questions.map(q => q.text));
    });
}

async function save(data){
    var jsonData = JSON.stringify(data);

    console.log("saving...")
    await fs.writeFile("./data.json", jsonData, function(err) {
        if (err) {
            console.log(err);
            return;
        } 

        console.log("data saved!");
    });
}

async function run(){
    
    const report = true;

    console.log("opening page");
    const page = await browser.newPage();

    console.log("redirecting page")
    await page.goto(settings.link);

    // click start
    async function clickStart(){
        await page.waitForSelector("#ContentPlaceHolder1_Button7");
        await page.click("#ContentPlaceHolder1_Button7");

    }

    // click the first question answer
    async function clickAnswer(){
        await page.waitForSelector("#ContentPlaceHolder1_Button1");
        await page.click("#ContentPlaceHolder1_Button1");
    }

    // find the answer on the current page and return it
    async function getAnswer(){
        var answers = ["#ContentPlaceHolder1_TextBox2", "#ContentPlaceHolder1_TextBox3", "#ContentPlaceHolder1_TextBox4", "#ContentPlaceHolder1_TextBox5"]
        var elements = [];
        for(var i = 0; i < 4; i ++){
            await page.waitForSelector(answers[i]);
        }


        return await page.evaluate(() => {
            var answers = ["#ContentPlaceHolder1_TextBox2", "#ContentPlaceHolder1_TextBox3", "#ContentPlaceHolder1_TextBox4", "#ContentPlaceHolder1_TextBox5"]

            var res = "not found";
            for(var i = 0; i < 4; i ++){
                var answer = answers[i];
                var elem = document.querySelector(answer);
                
                var color = window.getComputedStyle(elem).color
                var text = elem.value;

                if (color == "rgb(0, 153, 51)") res = text;
            }

            return res;
        });
    }

    // click the 'next' button
    async function clickNextButton(){
        await page.waitForSelector("#ContentPlaceHolder1_Button6");
        await page.click("#ContentPlaceHolder1_Button6");
    }
    
    // get the current dmv test question
    async function getQuestion(){
        await page.waitForSelector("#ContentPlaceHolder1_TextBox7");
        await page.waitForSelector("#ContentPlaceHolder1_Image1");

        var text = await page.$("#ContentPlaceHolder1_TextBox7")
            .then(x => x.getProperty("innerHTML"))
            .then(x => x.jsonValue())
        var img = await page.$("#ContentPlaceHolder1_Image1")
            .then(x => x.getProperty("src"))
            .then(x => x.jsonValue())
    
        return {
            text: text,
            img: img
        };
    }    

    // loop through a few questions
    for(var i = 0; i < 100; i ++){

        // start the test
        report && console.log("clicking start");
        await clickStart();


        // scrape the question
        report && console.log("getting question")
        var question = await getQuestion();
        
        // click the first answer
        report && console.log("clicking answer")
        await clickAnswer();

        // check if it exists in the database
        if (!questionNames.has(question.text)){

            // find the answer
            report && console.log("getting answer")
            let answer = await getAnswer();
            question.answer = answer;

            questionNames.add(question.text);

            // add the question
            questions.push(question);
            console.log("question added", questions.length);
        }
    }

    console.log("done");
    save(questions);

    page.close();
}