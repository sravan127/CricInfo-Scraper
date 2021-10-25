let fs=require("fs");
let axios=require("axios");
let minimist=require("minimist");
let path=require("path");
let jsdom=require("jsdom")
let excel=require("excel4node");
let pdf=require("pdf-lib");


//node 1_Website_Extractor.js --excel="summary.csv" --datafolder=worldcup --source="https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results"
let matches=[];
let teamsobj=[];
let cmdargs=minimist(process.argv);
let promise=axios.get(cmdargs.source);
promise.then(function(response){
    let dom=new jsdom.JSDOM(response.data);
    let document=dom.window.document;
    let matchinfo=document.querySelectorAll("div.match-score-block");
    for(let i=0;i<matchinfo.length;i++){
         let match={};
         let teamnames=matchinfo[i].querySelectorAll("p.name");
         match.team1=teamnames[0].textContent;
         match.team2=teamnames[1].textContent;
         let scorecards=matchinfo[i].querySelectorAll("span.score");
         if(scorecards[0]!==undefined){match.score1=scorecards[0].textContent}
         else{match.score1="NA"}
         if(scorecards[1]!==undefined){match.score2=scorecards[1].textContent}
         else{match.score2="NA"}
         
         let status=matchinfo[i].querySelector("div.status-text >span");
         match.result=status.textContent;
        // console.log(match);
        matches.push(match);
    }
    for(let i=0;i<matches.length;i++){
        maketeamobj(teamsobj,matches[i]);
    }
    for(let i=0;i<matches.length;i++){
        putopponentteams(teamsobj,matches[i]);
    }
    fs.writeFileSync("teams.json",JSON.stringify(teamsobj),"utf-8");
    fs.writeFileSync("matches.json",JSON.stringify(matches),"utf-8");
    createExcelFile(teamsobj);
    preparefoldersandpdfs(teamsobj,cmdargs.datafolder)
}).catch(function(err){
    console.log(err);
})


function preparefoldersandpdfs(teamsobj,folder){
    if(fs.existsSync(folder) == true){
        fs.rmdirSync(folder, { recursive: true });
    }
    fs.mkdirSync(folder);
    for(let i=0;i<teamsobj.length;i++){
        let foldername=path.join(folder,teamsobj[i].name);
        fs.mkdirSync(foldername);
        for(let j=0;j<teamsobj[i].matches.length;j++){
            let match=teamsobj[i].matches[j];
            createMatchScorecardPdf(foldername,teamsobj[i].name,match);
        }
    }
    

}


function createMatchScorecardPdf(teamFolderName,homeTeam,match){
    let matchFileName = path.join(teamFolderName, match.vs);

    let templateFileBytes = fs.readFileSync("Template.pdf");
    let pdfdocKaPromise = pdf.PDFDocument.load(templateFileBytes);
    pdfdocKaPromise.then(function (pdfdoc) {
        let page = pdfdoc.getPage(0);

        page.drawText(homeTeam, {
            x: 320,
            y: 703,
            size: 8
        });
        page.drawText(match.vs, {
            x: 320,
            y: 688,
            size: 8
        });
        page.drawText(match.selfScore, {
            x: 320,
            y: 673,
            size: 8
        });
        page.drawText(match.oppScore, {
            x: 320,
            y: 658,
            size: 8
        });
        page.drawText(match.result, {
            x: 320,
            y: 645,
            size: 8
        });

        let changedBytesKaPromise = pdfdoc.save();
        changedBytesKaPromise.then(function (changedBytes) {
            if(fs.existsSync(matchFileName + ".pdf") == true){
                fs.writeFileSync(matchFileName + "1.pdf", changedBytes);
            } else {
                fs.writeFileSync(matchFileName + ".pdf", changedBytes);
            }
        })
    })
}


function createExcelFile(teams) {
    let wb = new excel.Workbook();

    for (let i = 0; i < teams.length; i++) {
        let sheet = wb.addWorksheet(teams[i].name);

        sheet.cell(1, 1).string("VS");
        sheet.cell(1, 2).string("Self Score");
        sheet.cell(1, 3).string("Opp Score");
        sheet.cell(1, 4).string("Result");
        for (let j = 0; j < teams[i].matches.length; j++) {
            sheet.cell(2 + j, 1).string(teams[i].matches[j].vs);
            sheet.cell(2 + j, 2).string(teams[i].matches[j].selfScore);
            sheet.cell(2 + j, 3).string(teams[i].matches[j].oppScore);
            sheet.cell(2 + j, 4).string(teams[i].matches[j].result);
        }
    }

    wb.write(cmdargs.excel);
}


function maketeamobj(teamsobj,match){
    let index=-1;
    for(let i=0;i<teamsobj.length;i++){
        if(teamsobj[i].name===match.team1){
            index=i;break;
        }
    }
    if(index===-1){
        let team={
            name: match.team1,
            matches:[]
        };
        teamsobj.push(team);
    }
    index=-1;
    for(let i=0;i<teamsobj.length;i++){
        if(teamsobj[i].name===match.team2){
            index=i;break;
        }
    }
    if(index===-1){
        let team={
            name: match.team2,
            matches:[]
        };
        teamsobj.push(team);
    }

}


function putopponentteams(teamsobj,match){
    let index=-1;
    for(let i=0;i<teamsobj.length;i++){
        if(teamsobj[i].name===match.team1){
            index=i;
            break;
        }
    }
    teamsobj[index].matches.push({
        vs : match.team2,
        selfScore: match.score1,
        oppScore: match.score2,
        result: match.result
    });
    index=-1;
    for(let i=0;i<teamsobj.length;i++){
        if(teamsobj[i].name===match.team2){
            index=i;
            break;
        }
    }
    teamsobj[index].matches.push({
        vs : match.team1,
        selfScore: match.score2,
        oppScore: match.score1,
        result: match.result
    });
}
