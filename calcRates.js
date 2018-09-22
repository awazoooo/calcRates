(function (){
    const CHUNITHM_NET_GENRE_URL = "https://chunithm-net.com/mobile/MusicGenre.html";
    const CHUNITHM_FRIENDVS_URL = "https://chunithm-net.com/mobile/FriendLevelVs.html"
    const INTERVAL = 3000;
    const DEFAULTVERSION = 'starplus'; // 現在のバージョン
    const TOOLNAME = '旧verのレート計算';
    const TOOLNAME_SYNTHESIS = 'フレンドとのベスト枠融合';

    Node.prototype.prependChild = function(e){ this.insertBefore(e,this.firstChild); }

    const _ajax = function(url, type, payload) {
        return new Promise(function(resolve, reject) {
            $.ajax({
                type: type,
                url: url,
                data: payload
            }).done(function(data, textStatus, jqXHR) {
                resolve(data);
            }).fail(function (jqXHR, textStatus, errorThrown){
                console.log(jqXHR, textStatus, errorThrown);
                reject("Error occured in ajax connection." + jqXHR.responseText);
            });
        })
    }

    const parseMusicBox = function(box) {
        if (typeof($(box).find(".text_b")[0]) == 'undefined')
            return {}
        // 楽曲タイトルを追加
        const musictitle = $(box).find('.music_title')[0].textContent;
        const difficulty = difficultyToId(box.className.match(/(master|basic|advanced|expert)/)[0]);
        const score = $(box).find(".text_b")[0].innerText.replace(/,/g,"");

        return { title: musictitle, difficulty: difficulty, score: score };
    }

    const parseMusicList = function(data) {
        const doc = $.parseHTML(data);
        const mb = $(doc).find(".musiclist_box");
        let musicdata = [];
        mb.each(function(i, e) {
            const onClickAttr = $(e).find('.music_title')[0].getAttribute("onclick");
            const attr = onClickAttr.match(/((\w+)_(\d+|\w+))/g);
            let data = {};
            attr.map(function(e) {
                const p = e.split("_");
                $.extend(data, {[p[0]]:p[1]})
            })
            const musicId = data.musicId;
            const obj = parseMusicBox(e);

            musicdata[musicId] = obj;
        })
            return musicdata;
    }
    
    var parseFriendVsData = function(data) {
        const doc = $.parseHTML(data);
        const mb = $(doc).find(".music_box");
        let musicData = [];
        mb.each(function(idx, val){
            const title = $(val).find('.block_underline')[0].textContent;
            const scores = $(val).find('.play_musicdata_highscore');
            const myscore = scores[0].textContent.replace(/,/g,"");
            const friendscore = scores[1].textContent.replace(/,/g,"");
            const diff = difficultyToId(val.className.match(/(master|basic|advanced|expert)/)[0]);
            musicData.push({ title: title, difficulty: diff, myscore: myscore, friendscore: friendscore});
        });

        const names = $(doc).find('.friend_vs_name');
        const myName = names[0].textContent;
        const friendName = names[1].textContent;
        return {data: musicData, myName: myName, friendName: friendName}
    }

    // フレンドVSのデータを取得(レベル13,14)
    var getFriendVsData = function(friendId){
        return Promise.resolve().then(function() {
            return new Promise(function(resolve, reject) {
                console.log("スコア取得中:[Level14]");
                setTimeout(function(){
                    _ajax(CHUNITHM_FRIENDVS_URL, "post", {level: "14", friend: friendId, friendvs: "friendvs"}).then(function(data) {
                        friend14data = parseFriendVsData(data);
                        resolve();
                    })}, INTERVAL);
            })
        }).then(function () {
            return new Promise(function(resolve, reject) {
                console.log("スコア取得中:[Level13]");
                setTimeout(function(){
                    _ajax(CHUNITHM_FRIENDVS_URL, "post", {level: "13", friend: friendId, friendvs: "friendvs"}).then(function(data) {
                        friend13data = parseFriendVsData(data);
                        resolve();
                    })}, INTERVAL);
            })
        })// .then(function () {
        //     return new Promise(function(resolve, reject) {
        //         console.log("スコア取得中:[Level12]");
        //         setTimeout(function(){
        //             _ajax(CHUNITHM_FRIENDVS_URL, "post", {level: "12", friend: friendId, friendvs: "friendvs"}).then(function(data) {
        //                 friend12data = parseFriendVsData(data);
        //                 resolve();
        //             })}, INTERVAL);
        //     })
        // })
            .then(function(){
            return { // 12: friend12data.data,
                     13: friend13data.data, 14: friend14data.data, myName: friend14data.myName, friendName: friend14data.friendName };
        })
    }
    
    const getPlayerScore = function() {
        // 楽曲一覧
        let musicDetail = [];
        let masterMusicData = [];

        return Promise.resolve().then(function() {
            return new Promise(function(resolve, reject) {
                console.log("スコア取得中:[MASTER]"); 
                setTimeout(function() { 
                    _ajax(CHUNITHM_NET_GENRE_URL, "post", {genre:99, level:"master", music_genre:"music_genre"}).then(function(data) {
                        masterMusicData = parseMusicList(data);
                        resolve();
                    })
                }, INTERVAL);
            })
        }).then(function() {
            return new Promise(function(resolve, reject) {
                console.log("スコア取得中:[EXPERT]"); 
                setTimeout(function() { 
                    _ajax(CHUNITHM_NET_GENRE_URL, "post", {genre:99, level:"expert", music_genre:"music_genre"}).then(function(data) {
                        expertMusicData = parseMusicList(data);
                        resolve();
                    })
                }, INTERVAL);
            })
        }).then(function() {
            for(let musicId in masterMusicData) {
                const musicDataObj = {
                    music_id: musicId,
                    scoreData : {
                        expert: expertMusicData[musicId],
                        master: masterMusicData[musicId]
                    }
                };
                musicDetail.push(musicDataObj);
            }
            return musicDetail;
        }).then(function(data) {
            return data;
        })
    }
    // ここまで参考: https://chuniviewer.net/js/getMusicScore.js


    // 単曲レート値の計算
    // http://www.atomic--age.net/information/chunithm/system#TOC--14

    const RANKSSS    = 1007500;
    const RANKSSplus = 1005000;
    const RANKSS     = 1000000;
    const RANKS      = 975000;
    const RANKAAA    = 950000;
    const RANKAA     = 925000;
    const RANKA      = 900000;

    const calcRate = function(constant, score){
        if (score >= RANKSSS){
            return constant + 2.0;
        } else if (score >= RANKSSplus){
            return constant + 1.5 + (score - RANKSSplus) / 5000;
        } else if (score >= RANKSS){
            return constant + 1.0 + (score - RANKSS) / 10000;
        } else if (score >= RANKS){
            return constant + (score - RANKS) / 25000;
        } else if (score >= RANKAAA){
            return constant - 1.5 + (score - RANKAAA) * 3 / 50000;
        } else if (score >= RANKAA){
            return constant - 3.0 + (score - RANKAA) * 3 / 50000;
        } else if (score >= RANKA) {
            return constant - 5.0 + (score - RANKA) / 12500;
        } else {
            return 0.0;
        }
    }

    // 定数表から定数を取ってくる
    const getConstant = function(title, diff, version){
        for (let item of constantTable){
            if (item.title == title && item.difficulty == diff){
                return item.constant[version];
            }
        }
        return 0;
    }

    // ベスト枠のソート
    // 単曲レート値で比較 -> スコアで比較
    const sortByRate = function(best){
        return best.sort(
            function (x, y){
                if (x.rate > y.rate)
                    return -1;
                if (x.rate < y.rate)
                    return 1;
                if (x.score > y.score)
                    return -1;
                if (x.score < y.score)
                    return 1;
            });
    }

    // 小数点以下2位までに丸める
    const round2 = function(num){
        return Math.floor(num * Math.pow(10, 2)) / Math.pow(10, 2);
    }

    // stringからカンマを除外
    // スコアデータをintで管理するため
    const removeComma = function(str){
        return str.split(',').join('');
    }

    // stringにカンマを付与
    // お金と同じように3桁ずつ区切る
    const addComma = function(str){
        const nsplit = 3;
        const rev = str.split('').reverse().join('');
        let strl = [];
        for (let i = 0; i < rev.length; i += nsplit) {
            strl.push(rev.substr(i, nsplit));
            strl.push(',');
        }
        const res = strl.reduce(function (s1, s2){ return s1 + s2 }).split('').reverse().join('');
        return res.slice(1, res.length);
    }

    // ベスト平均などを計算
    const calcParams = function(best){
        let s = best.map(function (x) { return x.rate });
        s = round2(s.reduce(function (x, y){ return x + y }));

        const ave = round2(s / 30.0);
        const top = round2(best[0].rate);
        const reach = round2((s + top * 10) / 40.0);
        const min = round2(best[(best.length-1)].rate);

        return { sum: s, average: ave, minrate: min, reachable: reach };
    }

    // 先人の知恵
    const createResultBox = function(text, result) {
        let left = document.createElement('div');
        left.classList.add('score_list_left');
        left.textContent = text;
        let right = document.createElement('div');
        right.classList.add('score_list_right');
        right.textContent = result;
        let d = document.createElement('div');
        d.classList.add('score_list');
        d.appendChild(left);
        d.appendChild(right);
        return d;
    }

    const createMusicBox = function(musicName, diff, scoreNum, mrate, c, ownerData){
        // CONSTANT部分のelement
        let result = document.createElement('div');
        result.classList.add('play_musicdata_highscore');
        result.textContent = 'CONSTANT: ';
        let constant = document.createElement('span');
        constant.classList.add('text_b');
        constant.textContent = c;
        result.appendChild(constant);
        
        // HIGH SCORE部分のelement
        let score = document.createElement('div');
        score.textContent = 'HIGH SCORE: ';
        let scoreb = document.createElement('span');
        scoreb.classList.add('text_b');
        scoreb.textContent = addComma(scoreNum.toString(10));
        score.appendChild(scoreb);

        result.appendChild(score);

        // RATE部分のelement
        let rate = document.createElement('div');
        rate.textContent = 'RATING: '
        let rateb = document.createElement('span');
        rateb.classList.add('text_b');
        rateb.textContent = round2(mrate);
        rate.appendChild(rateb);

        result.appendChild(rate);

        if(ownerData.isFriend){
            // OWNER部分のelement
            let own = document.createElement('div');
            own.textContent = 'OWNER: '
            let ownb = document.createElement('span');
            ownb.classList.add('text_b');
            ownb.textContent = ownerData.owner;
            own.appendChild(ownb);

            result.appendChild(own);
        } 

        // music title
        let title = document.createElement('div');
        title.classList.add('music_title');
        title.textContent = musicName

        // music box
        let musicBox = document.createElement('div');
        // boxのcssを指定
        let level = 'bg_' + diff; 
        musicBox.classList.add('w388', 'musiclist_box', level);

        musicBox.appendChild(title);
        musicBox.appendChild(result);

        return musicBox;
    }

    // twitter
    const createTweetButton = function(params, version, addMsg){
        let url = 'http://twitter.com/intent/tweet?text=';
        url += addMsg;
        url += '\nBest枠(';
        url += version + ')';
        url += '%0a合計:%20' + params.sum + '%0a平均:%20' + params.average + '%0a下限:%20' + params.minrate + '%0a到達可能:%20' + params.reachable + '%0ahttps://awazoooo.github.io/calcRates/';
        let left = document.createElement('div');
        left.classList.add('score_list_left');
        let right = document.createElement('div');
        right.classList.add('score_list_right');
        ad = document.createElement('a');
        ad.href = url;
        ad.target = '_blank';
        ad.innerHTML = 'Twitterに投稿';
        right.appendChild(ad)
        let d = document.createElement('div');
        d.classList.add('score_list');
        d.appendChild(left);
        d.appendChild(right);
        return d;
    }

    // HTMLを書き換える
    // 4つ目はFriendVSの時にtrue
    const createHTML = function(data, params, version, isFriend, twiAddMsg){
        let src = document.getElementsByClassName('box01 w420');

        // ベスト枠
        let best = document.createElement('div');
        best.classList.add('box05', 'w400');
        let best_title = document.createElement('div');
        best_title.classList.add('genre');
        best_title.textContent = (version != "special") ? 'ベスト枠(' + version + ')' : 'レベル13以上のワースト枠'
        best.appendChild(best_title);
        src[0].prependChild(best);

        // 楽曲のbox
        for (let item of data){
            if (item.score == null) break;
            let m;
            if (isFriend){
                m = createMusicBox(item.title, item.difficulty, item.score, item.rate, item.constant, {isFriend: isFriend, owner: item.owner});
            } else {
                m = createMusicBox(item.title, item.difficulty, item.score, item.rate, item.constant, {isFriend: isFriend});
            }
            best_title.appendChild(m);
        }

        // textbox挿入(narrow_box)
        // ベスト枠の平均などを表示
        let narrow_block = document.createElement('div');
        narrow_block.classList.add('narrow_block', 'clearfix');
        src[0].prependChild(narrow_block);
        narrow_block.appendChild(createTweetButton(params, version, twiAddMsg));
        narrow_block.appendChild(createResultBox("合計", params.sum));
        narrow_block.appendChild(createResultBox("平均", params.average));
        narrow_block.appendChild(createResultBox("下限", params.minrate));
        narrow_block.appendChild(createResultBox("到達可能", params.reachable));

        let box01_title = document.createElement('div');
        box01_title.classList.add('box01_title');
        if(isFriend){
            box01_title.textContent = TOOLNAME_SYNTHESIS;
        } else {
            box01_title.textContent = TOOLNAME;        
        }
        src[0].prependChild(box01_title);
    }

    // version毎のベスト枠を計算
    const calcBestOfVersion = function(data, version) {
        let musicarr = [];
        let worst = false;

        // 13↑の下から30曲のベストを計算する時
        if(version == "special"){
            version = DEFAULTVERSION;
            worst = true;
        }

        // 必要 -> 曲名・難易度・定数・スコア・レート値
        for (let item of data){
            // expertとmasterの2回分繰り返す
            for (let diff of ['expert', 'master']){
                // 未プレイ
                if (Object.keys(item.scoreData[diff]).length == 0) continue;
                
                const c = getConstant(item.scoreData[diff].title, parseInt(item.scoreData[diff].difficulty, 10), version);
                
                // special(13以上の中でワースト枠を計算する)の時
                if (worst && c < 13.0) continue;

                // 定数が0(難易度12以下)はスキップ
                if (c == 0) continue;
                const rate = calcRate(c, item.scoreData[diff].score);
                musicarr.push({ title: item.scoreData[diff].title, difficulty: diff, constant: c, score: item.scoreData[diff].score, rate: rate} )
            }
        }

        const sorted = sortByRate(musicarr);
        const best = worst ? sorted.reverse().slice(0, 30).reverse() : sorted.slice(0, 30);
        const params = calcParams(best);

        return [best, params];
    }

    // musicがmusicListに含まれるかどうか
    // 実際に判定するのは曲名と難易度が等しいかどうか
    const member = function(musicList, music){
        for (let m of musicList){
            if (m.title == music.title && m.difficulty == music.difficulty)
                return true;
        }
        return false;
    }

    // 自分とフレンドのベスト枠を融合して返す
    const synthesis = function(myScore, friendScore) {
        let best = [].concat(myScore, friendScore);
        best.filter(function(x) { return x.title != "" });
        const sorted = sortByRate(best);
        
        let exists = [];
        let synthesis = [];

        for (let m of sorted){
            if (member(exists, m))
                continue;

            exists.push(m);
            synthesis.push(m);
        }
        
        return synthesis.slice(0, 30);
    }

    // フレンドと融合したベスト枠を計算
    const calcBests = function(data, version) {
        let myScore = [];
        let friendScore = [];

        let myName = data.myName;
        let friendName = data.friendName;

        for (let level of ["14", "13"// , "12"
                          ]){
            for (let music of data[level]){
                const c = getConstant(music.title, music.difficulty, version);
                // 定数が0(難易度12未満)はスキップ
                if (c == 0) continue;
                const myrate = round2(calcRate(c, music.myscore));
                const friendrate = round2(calcRate(c, music.friendscore));
                myScore.push({title: music.title, difficulty: idToDifficulty(music.difficulty), constant: c, score: music.myscore, rate: myrate, owner: myName});
                friendScore.push({title: music.title, difficulty: idToDifficulty(music.difficulty), constant: c, score: music.friendscore, rate: friendrate, owner: friendName});
            }
        }

        const mySorted = sortByRate(myScore);
        const friendSorted = sortByRate(friendScore);
        const mybest = mySorted.slice(0, 30);
        const friendbest = friendSorted.slice(0, 30);
        const synthesisBest = synthesis(mybest, friendbest);
        const params = calcParams(synthesisBest);

        return [synthesisBest, params];
    }

    // 定数表の出力(for debug)
    const printTable = function(table){    
        let output = '[\n';
        for (let item of table){
            let s = '{ title: "';
            s += item.title
            s += '", musicId: ';
            s += item.musicId;
            s += ', difficulty: ';
            s += item.difficulty;
            s += ', constant: ';
            s += item.constant;
            s += ' },\n';
            output += s;
        }
        output += ']\n';
        console.log(output);
    }

    // 取得したスコアデータ
    let scoreData;

    // フレンドと自分のスコアデータ
    let friendData;

    // セレクトボックスと計算ボタンの作成
    const makeSelectUI = function() {
        let select = $("<select>").attr('id', 'select');
        const versions = [["STARPLUS", "starplus"], ["STAR", "star"], ["AIRPLUS", "airplus"], ["AIR", "air"], ["無印PLUS", "plus"], ["無印", "origin"], ["13↑の下から", "special"]];
        for (let i in versions) {
            select.append($("<option>").html(versions[i][0]).val(versions[i][1]));
        }
        let button = $("<button>").attr('id', 'calcButton');

        // ボタンを押すとベスト枠を計算、HTMLを書き換える
        button.html('計算！').on("click", () => {
            const selectedVersion = $("[id=select]").val();
            const data = calcBestOfVersion(scoreData, selectedVersion);
            console.log('constructing HTML...');
            try {
                createHTML(data[0], data[1], selectedVersion, false, "");
            } catch (e) {
                alert('「MASTER」を選択してから実行してください...');
                return;
            }
            console.log('finished!!!');
        });

        select.appendTo("#main_menu");
        button.appendTo("#main_menu");
    }

    const makeSynthesisButton = function(){
        let button = $("<button>").attr('id', 'synthesisButton');

        button.html('計算！').on("click", () => {
            // 選択されているフレンド名
            const friendName = friendData.friendName;
            console.log("friend: " + friendName);
            const synthesizedBest = calcBests(friendData, DEFAULTVERSION);
            console.log('constructing HTML...');
            let msg = friendName + "とのベスト枠融合！";
            try {
                createHTML(synthesizedBest[0], synthesizedBest[1], DEFAULTVERSION, true, msg);
            } catch (e) {
                alert('「バトル開始」してから実行して下さい...');
                return;
            }
            console.log('finished!!!');
        });
        button.appendTo("#main_menu");
    }

    // for util
    const printList = function(l) {
         let output = '[\n'
         for(let e of l){
             output += e
             output += '\n'
         }
         output += ']'
         console.log(output)
    }

    // make sample data
    const makeSampleData = function (){
        const oddList  = [13.1,13.3,13.5,13.7,13.9];
        const evenList = [13,13.2,13.4,13.6,13.8];

        const v = DEFAULTVERSION;

        const sample1 = getMusicsByLevel(v, oddList);
        const sample2 = getMusicsByLevel(v, evenList);

        let score1 = [];
        for (let m of sample1)
            score1.push({title: m.title, difficulty: idToDifficulty(m.difficulty), constant: m.constant[v], score: 1008000, rate: m.constant[v] + 2, owner: "ゴリラ1"});

        let score2 = [];
        for (let m of sample2)
            score1.push({title: m.title, difficulty: idToDifficulty(m.difficulty), constant: m.constant[v], score: 1008000, rate: m.constant[v] + 2, owner: "ゴリラ2"});

        const mySorted = sortByRate(score1);
        const friendSorted = sortByRate(score2);
        const mybest = mySorted.slice(0, 30);
        const friendbest = friendSorted.slice(0, 30);
        const synthesisBest = synthesis(mybest, friendbest);
        const params = calcParams(synthesisBest);

        const msg = "ゴリラ2とのベスト枠融合！\n";
        createHTML(synthesisBest, params, DEFAULTVERSION, true, msg);
    }

    const main = function() {
        const url = location.href;
        if (url.indexOf('MusicGenre') >= 0){
            makeSelectUI();

            Promise.resolve().then( () => {
                // スコアデータ取得中はdisabled
                $("#calcButton").prop("disabled", true);
            }).then( () => {
                return getPlayerScore();
            }).then(function(data){
                console.log('finished scraping data!');
                scoreData = data;
                alert('スコアの取得が完了しました');
                return Promise.resolve();
            }).then( () => {
                // ボタンをenabled
                $("#calcButton").prop("disabled", false);
            });

        } else if (url.indexOf('FriendLevelVs') >= 0){
            // 計算ボタンを作成
            makeSynthesisButton();

            Promise.resolve().then( () => {
                $("#synthesisButton").prop("disabled", true);
            }).then( () => {
                const friendId = $('[name=friend]').val();
                return getFriendVsData(friendId);
            }).then(function(data){
                console.log('finished scraping data!');
                friendData = data;
                //makeSampleData();
                return Promise.resolve();
            }).then( () => {
                $("#synthesisButton").prop("disabled", false);
            });

        } else {
            alert('「楽曲別レコード」のページで「MASTER」を選択してから実行してください...');
            return;
        }
    }
    main();
})();
