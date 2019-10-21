(function() {
  const CHUNITHM_NET_GENRE_URL =
    "https://chunithm-net.com/mobile/record/musicGenre";
  const INTERVAL = 3000;
  const DEFAULTVERSION = "starplus"; // current version
  const TOOLNAME = "旧バージョン時点のレート計算";

  Node.prototype.prependChild = function(e) {
    this.insertBefore(e, this.firstChild);
  };

  const $ = jQuery;

  const _ajax = (url, type, payload) => {
    return new Promise((resolve, reject) => {
      $.ajax({
        type: type,
        url: url,
        data: payload
      })
        .done((data, textStatus, jqXHR) => {
          resolve(data);
        })
        .fail((jqXHR, textStatus, errorThrown) => {
          console.log(jqXHR, textStatus, errorThrown);
          reject("Error occured in ajax connection." + jqXHR.responseText);
        });
    }).catch(e => {
      console.log(e);
    });
  };

  const getDifficultyId = diff => {
    return diff == "master"
      ? 3
      : diff == "expert"
      ? 2
      : diff == "advanced"
      ? 1
      : 0;
  };

  const parseMusicBox = box => {
    if (typeof $(box).find(".text_b")[0] == "undefined") return {};
    const musictitle = $(box).find(".music_title")[0].textContent;
    const difficulty = getDifficultyId(
      box.className.match(/(master|basic|advanced|expert)/)[0]
    );
    const score = $(box)
      .find(".text_b")[0]
      .innerText.replace(/,/g, "");

    return { title: musictitle, difficulty: difficulty, score: score };
  };

  const parseMusicList = data => {
    const doc = $.parseHTML(data);
    const mb = $(doc).find(".musiclist_box");
    let musicdata = [];
    mb.each((i, e) => {
      const musicId = $(e)
        .find("input[name=idx]")[0]
        .getAttribute("value");
      const obj = parseMusicBox(e);
      musicdata[musicId] = obj;
    });
    return musicdata;
  };

  const getPlayerScore = () => {
    let musicDetail = [];
    let masterMusicData = [];

    const token = $(document)
      .find("input[name=token]")[0]
      .getAttribute("value");
    return Promise.resolve()
      .then(() => {
        return new Promise((resolve, reject) => {
          console.log("スコア取得中:[MASTER]");
          setTimeout(() => {
            _ajax(CHUNITHM_NET_GENRE_URL + "/sendMaster", "post", {
              genre: 99,
              token: token
            }).then(data => {
              masterMusicData = parseMusicList(data);
              resolve();
            });
          }, INTERVAL);
        });
      })
      .then(() => {
        return new Promise((resolve, reject) => {
          console.log("スコア取得中:[EXPERT]");
          setTimeout(() => {
            _ajax(CHUNITHM_NET_GENRE_URL + "/sendExpert", "post", {
              genre: 99,
              token: token
            }).then(data => {
              expertMusicData = parseMusicList(data);
              resolve();
            });
          }, INTERVAL);
        });
      })
      .then(() => {
        for (let musicId in masterMusicData) {
          const musicDataObj = {
            music_id: musicId,
            scoreData: {
              expert: expertMusicData[musicId],
              master: masterMusicData[musicId]
            }
          };
          musicDetail.push(musicDataObj);
        }
        return musicDetail;
      })
      .then(data => data);
  };

  // 単曲レート値の計算
  // http://www.atomic--age.net/information/chunithm/system#TOC--14

  const RANKSSS = 1007500;
  const RANKSSplus = 1005000;
  const RANKSS = 1000000;
  const RANKS = 975000;
  const RANKAAA = 950000;
  const RANKAA = 925000;
  const RANKA = 900000;

  const calcRate = (constant, score) => {
    if (score >= RANKSSS) {
      return constant + 2.0;
    } else if (score >= RANKSSplus) {
      return constant + 1.5 + (score - RANKSSplus) / 5000;
    } else if (score >= RANKSS) {
      return constant + 1.0 + (score - RANKSS) / 10000;
    } else if (score >= RANKS) {
      return constant + (score - RANKS) / 25000;
    } else if (score >= RANKAAA) {
      return constant - 1.5 + ((score - RANKAAA) * 3) / 50000;
    } else if (score >= RANKAA) {
      return constant - 3.0 + ((score - RANKAA) * 3) / 50000;
    } else if (score >= RANKA) {
      return constant - 5.0 + (score - RANKA) / 12500;
    } else {
      return 0.0;
    }
  };

  // 定数表から定数を取得
  const getConstant = (title, diff, version) => {
    const c = constantTable.filter(
      e => e.title == title && e.difficulty == diff
    );
    if (c.length == 0) return 0.0;
    return c[0].constant[version] || 0.0;
  };

  // ベスト枠のソート
  // 単曲レート値で比較 -> スコアで比較
  const sortByRate = best => {
    return best.sort((x, y) => {
      if (x.rate > y.rate) return -1;
      if (x.rate < y.rate) return 1;
      if (x.score > y.score) return -1;
      if (x.score < y.score) return 1;
    });
  };

  // 小数点以下2位までに丸める
  const round2 = num => Math.floor(num * Math.pow(10, 2)) / Math.pow(10, 2);

  // stringからカンマを除外
  // スコアデータをintで管理するため
  const removeComma = str => str.split(",").join("");

  // stringにカンマを付与
  // お金と同じように3桁ずつ区切る
  const addComma = str => {
    const nsplit = 3;
    const rev = str
      .split("")
      .reverse()
      .join("");
    let strl = [];
    for (let i = 0; i < rev.length; i += nsplit) {
      strl.push(rev.substr(i, nsplit));
      strl.push(",");
    }
    const res = strl
      .reduce((s1, s2) => {
        return s1 + s2;
      })
      .split("")
      .reverse()
      .join("");
    return res.slice(1, res.length);
  };

  // ベスト平均などを計算
  const calcParams = best => {
    let s = best.map(x => x.rate);
    s = round2(
      s.reduce((x, y) => {
        return x + y;
      })
    );

    const ave = round2(s / 30.0);
    const top = round2(best[0].rate);
    const reach = round2((s + top * 10) / 40.0);
    const min = round2(best[best.length - 1].rate);

    return { sum: s, average: ave, minrate: min, reachable: reach };
  };

  // 先人の知恵
  const createResultBox = (text, result) => {
    let left = document.createElement("div");
    left.classList.add("score_list_left");
    left.textContent = text;
    let right = document.createElement("div");
    right.classList.add("score_list_right");
    right.textContent = result;
    let d = document.createElement("div");
    d.classList.add("score_list");
    d.appendChild(left);
    d.appendChild(right);
    return d;
  };

  const createMusicBox = (musicName, diff, scoreNum, mrate, c) => {
    // CONSTANT部分のelement
    let result = document.createElement("div");
    result.classList.add("play_musicdata_highscore");
    result.textContent = "CONSTANT: ";
    let constant = document.createElement("span");
    constant.classList.add("text_b");
    constant.textContent = c;
    result.appendChild(constant);

    // HIGH SCORE部分のelement
    let score = document.createElement("div");
    score.textContent = "HIGH SCORE: ";
    let scoreb = document.createElement("span");
    scoreb.classList.add("text_b");
    scoreb.textContent = addComma(scoreNum.toString(10));
    score.appendChild(scoreb);

    result.appendChild(score);

    // RATE部分のelement
    let rate = document.createElement("div");
    rate.textContent = "RATING: ";
    let rateb = document.createElement("span");
    rateb.classList.add("text_b");
    rateb.textContent = round2(mrate);
    rate.appendChild(rateb);

    result.appendChild(rate);

    // music title
    let title = document.createElement("div");
    title.classList.add("music_title");
    title.textContent = musicName;

    // music box
    let musicBox = document.createElement("div");
    // boxのcssを指定
    let level = "bg_" + diff;
    musicBox.classList.add("w388", "musiclist_box", level);

    musicBox.appendChild(title);
    musicBox.appendChild(result);

    return musicBox;
  };

  // twitter
  const createTweetButton = (params, version, addMsg) => {
    let url = "http://twitter.com/intent/tweet?text=";
    url += addMsg;
    url += "\nBest枠(";
    url += version + ")";
    url +=
      "%0a合計:%20" +
      params.sum +
      "%0a平均:%20" +
      params.average +
      "%0a下限:%20" +
      params.minrate +
      "%0a到達可能:%20" +
      params.reachable +
      "%0ahttps://awazoooo.github.io/calcRates/\n #旧verレート計算";
    let left = document.createElement("div");
    left.classList.add("score_list_left");
    let right = document.createElement("div");
    right.classList.add("score_list_right");
    ad = document.createElement("a");
    ad.href = url;
    ad.target = "_blank";
    ad.innerHTML = "Twitterに投稿";
    right.appendChild(ad);
    let d = document.createElement("div");
    d.classList.add("score_list");
    d.appendChild(left);
    d.appendChild(right);
    return d;
  };

  // HTMLを書き換える
  const createHTML = (data, params, version, twiAddMsg) => {
    let src = document.getElementsByClassName("box01 w420");

    // ベスト枠
    let best = document.createElement("div");
    best.classList.add("box05", "w400");
    let best_title = document.createElement("div");
    best_title.classList.add("genre");
    best_title.textContent =
      version != "special"
        ? "ベスト枠(" + version + ")"
        : "レベル13以上のワースト枠";
    best.appendChild(best_title);
    src[0].prependChild(best);

    // 楽曲のbox
    for (let item of data) {
      if (item.score == null) break;
      let m;
      m = createMusicBox(
        item.title,
        item.difficulty,
        item.score,
        item.rate,
        item.constant
      );
      best_title.appendChild(m);
    }

    // textbox挿入(narrow_box)
    // ベスト枠の平均などを表示
    let narrow_block = document.createElement("div");
    narrow_block.classList.add("narrow_block", "clearfix");
    src[0].prependChild(narrow_block);
    narrow_block.appendChild(createTweetButton(params, version, twiAddMsg));
    narrow_block.appendChild(createResultBox("合計", params.sum));
    narrow_block.appendChild(createResultBox("平均", params.average));
    narrow_block.appendChild(createResultBox("下限", params.minrate));
    narrow_block.appendChild(createResultBox("到達可能", params.reachable));

    let box01_title = document.createElement("div");
    box01_title.classList.add("box01_title");
    box01_title.textContent = TOOLNAME;
    src[0].prependChild(box01_title);
  };

  // version毎のベスト枠を計算
  const calcBestOfVersion = (data, version) => {
    let musicarr = [];
    let worst = false;

    // 13↑の下から30曲のベストを計算する時
    if (version == "special") {
      version = DEFAULTVERSION;
      worst = true;
    }

    // 必要 -> 曲名・難易度・定数・スコア・レート値
    for (let item of data) {
      // expertとmasterの2回分繰り返す
      for (let diff of ["expert", "master"]) {
        // 未プレイ
        if (Object.keys(item.scoreData[diff]).length == 0) continue;

        const c = getConstant(
          item.scoreData[diff].title,
          parseInt(item.scoreData[diff].difficulty, 10),
          version
        );

        // special(13以上の中でワースト枠を計算する)の時
        if (worst && c < 13.0) continue;

        // 定数が0(難易度12以下)はスキップ
        if (c == 0) continue;
        const rate = calcRate(c, item.scoreData[diff].score);
        const m = {
          title: item.scoreData[diff].title,
          difficulty: diff,
          constant: c,
          score: item.scoreData[diff].score,
          rate: rate
        };
        musicarr.push(m);
      }
    }

    const sorted = sortByRate(musicarr);
    const best = worst
      ? sorted
          .reverse()
          .slice(0, 30)
          .reverse()
      : sorted.slice(0, 30);
    const params = calcParams(best);

    return [best, params];
  };

  // 定数表の出力(for debug)
  const printTable = table => {
    let output = "[\n";
    for (let item of table) {
      let s = '{ title: "';
      s += item.title;
      s += '", musicId: ';
      s += item.musicId;
      s += ", difficulty: ";
      s += item.difficulty;
      s += ", constant: ";
      s += item.constant;
      s += " },\n";
      output += s;
    }
    output += "]\n";
    console.log(output);
  };

  // 取得したスコアデータ
  let scoreData;

  // セレクトボックスと計算ボタンの作成
  const makeSelectUI = () => {
    let select = $("<select>").attr("id", "select");
    const versions = [
      ["STARPLUS", "starplus"],
      ["STAR", "star"],
      ["AIRPLUS", "airplus"],
      ["AIR", "air"],
      ["無印PLUS", "plus"],
      ["無印", "origin"],
      ["13↑の下から", "special"]
    ];
    for (let i in versions) {
      select.append(
        $("<option>")
          .html(versions[i][0])
          .val(versions[i][1])
      );
    }
    let button = $("<button>").attr("id", "calcButton");

    // ボタンを押すとベスト枠を計算、HTMLを書き換える
    button.html("計算！").on("click", () => {
      const selectedVersion = $("[id=select]").val();
      const data = calcBestOfVersion(scoreData, selectedVersion);
      console.log("constructing HTML...");
      try {
        createHTML(data[0], data[1], selectedVersion, "");
      } catch (e) {
        alert("「MASTER」を選択してから実行してください...");
        return;
      }
      console.log("finished!!!");
    });

    select.appendTo("#main_menu");
    button.appendTo("#main_menu");
  };

  const main = () => {
    const url = location.href;
    if (url.indexOf("musicGenre") >= 0) {
      makeSelectUI();

      Promise.resolve()
        .then(() => {
          // スコアデータ取得中はdisabled
          $("#calcButton").prop("disabled", true);
        })
        .then(() => {
          return getPlayerScore();
        })
        .then(data => {
          console.log("finished scraping data!");
          scoreData = data;
          alert("スコアの取得が完了しました");
          return Promise.resolve();
        })
        .then(() => {
          // ボタンをenabled
          $("#calcButton").prop("disabled", false);
        });
    } else {
      alert(
        "「楽曲別レコード」のページで「MASTER」を選択してから実行してください..."
      );
      return;
    }
  };
  main();
})();
