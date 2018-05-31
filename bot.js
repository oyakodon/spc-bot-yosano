import Botkit from "botkit";
import math from "mathjs";
import schedule from 'node-schedule'
import fs from "fs";

import Random from "./xsrnd";
import Hanshin from "./hanshin";

const hanshin = new Hanshin();                // 阪神算
const rnd = new Random(new Date().getTime()); // 乱数

// サイコロ
const dice = ['⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const re_dices = /(サイコロ|[dD][iI][cC][eE])/g;  // サイコロ複数
const re_dice = /サイコロ|[dD][iI][cC][eE]/;      // サイコロ一個
const re_dicek = /(:dicek:)/g;
const re_daisuke = /(:daisuke:)/g;

// 全角 -> 半角
const  repl_tbl = {
  "０": "0", "１": "1", "２": "2", "３": "3", "４": "4",
  "５": "5","６": "6", "７": "7", "８": "8", "９": "9",
  "＋": "+", "－": "-", "×": "*", "÷": "/", "＊": "*",
  "！": "!", "√": "sqrt"
};

const fmtDate = (date = new Date()) =>
{
    const y = date.getFullYear();
    const mon = date.getMonth() + 1;
    const d = date.getDate();
    const h = date.getHours();
    const min = date.getMinutes()
    const s = date.getSeconds();

    return　`${y} 年 ${mon} 月 ${d} 日  ${h} 時 ${min} 分 ${s} 秒`;
}

const str_to_dice = (str) =>
{
  let res = str.split(re_dicek).map(elm => 
  {
    // :dicek: -> :daisuke:
    if (elm == ":dicek:")
    {
      return ":daisuke:";
    }

    // --- :dicek:のいない世界 ---
    let s = elm.split(re_dices).map(_elm =>
    {
      // dice, Dice, ... -> ⚀
      if (re_dice.test(_elm))
      {
        return dice[rnd.nextInt(0, 6)];
      }

      // --- :dicek:, diceのいない世界 ---
      return _elm;
    }).join('');

    // :daisuke: -> :dicek:
    return s.replace(re_daisuke, ":dicek:");
  }).join('');

  return res;
}

const str_to_hanshin = (str) =>
{
  let ret = str + "";
  // 全角文字を置換
  ret = ret.split("").map((ch) =>
  {
      return repl_tbl.hasOwnProperty(ch) ? repl_tbl[ch] : ch;
  }).join("");

  const re_expr = ret.match(/^[0-9\+\-\*\/\(\)\!\(sqrt)]+$/);
  if (re_expr == null) return null;

  console.log("str_to_hanshin: ret = " + ret);

  if (re_expr == ret)
  {
    // 文字列全体が式
    let v = expr_to_v(ret);
    let ishan = hanshin.isValid(ret);
    console.log("ishan: " + ishan);
    if (v == null) return null;
    console.log("全体: v = " + v);
    let han = hanshin.get(v);
    console.log("han = " + han);
    return han == null ? ":no_good: " + v + " :no_good:" : (ishan ? v : han.replace("sqrt", "√")) + "";
  } else
  {
    // 文字列に式が含まれている
    let err = false;
    re_expr.forEach(elm =>
    {
      let v = expr_to_v(elm);
      let ishan = hanshin.isValid(elm);
      console.log("ishan: " + ishan);
      if (v == null) err = true;
      console.log("部分: v = " + v);
      let han = v == null ? null : hanshin.get(v);
      console.log("han = " + han);
      ret = ret.replace(elm, han == null ? ":no_good: " + v + " :no_good:" : (ishan ? v : han.replace("sqrt", "√")));
    });
    return err ? null : ret;
  }
}

const expr_to_v = (expr) =>
{
  hanshin.set(expr);
  try
  {
     const v = math.eval(expr);
     const n = math.number(v);
     return math.isInteger(n) ? n : null;
  }
  catch (e)
  {
      console.log(e);
      return null;
  }
}

const get_date_diff = (start, end) =>
{
　　const msDiff = end.getTime() - start.getTime();
　　const daysDiff = math.floor(msDiff / (1000 * 60 * 60 *24));
　　return daysDiff + 1;
}

const count_down_procon = () =>
{
  const diff = get_date_diff(new Date(), new Date(settings.procon));

  if (diff >= -1)
  {
    let text = "";
    if (diff == 0) text = `プロコン ${hanshin.get(1)} 日目です！頑張ってください！`;
    else if (diff == -1) text = `プロコン ${hanshin.get(2)} 日目です！頑張ってください！`;
    else text = `プロコンまであと ${hanshin.get(diff)} 日です。`;

    return text;
  }

  return null;
}

// process.env.DEBUG = true;

math.config({
  number: "BigNumber",
  precision: 64
});

const controller = Botkit.slackbot({
  debug: !!process.env.DEBUG,
  retry: Infinity
});
const settings = JSON.parse(fs.readFileSync("./settings.json", "utf8"));

const slackbot = controller.spawn({ token: settings.token });

slackbot.startRTM((err, bot, payload) =>
{
  if (err)
  {
    throw new Error('Could not connect to Slack');
  }

  // スケジュール登録
  schedule.scheduleJob('0 8 * * *', () =>
  {
    const procon = count_down_procon();

    if (procon != null)
    {
      bot.say({text: procon, channel: "procon"});
    }

    const today = new Date();
    if (today.getMonth() + 1 == 5 && today.getDate() == 31)
    {
      // プログラミング愛好会 設立記念日
      bot.say({text: "今日は、 プログラミング愛好会 設立記念日 です！", channel: "zatudan"});
    }
  });

});

controller.on(["ambient"], (bot, message) =>
{
  if (!!process.env.DEBUG)
  {
    console.log(message);
  }

  if (!settings.channels.includes(message.channel)) return;
  
  message.text.split('\n').forEach(msg => 
  {
    // コマンド
    if (msg.startsWith(settings.prefix))
    {
      const cmd = msg.split(" ");

      switch (cmd[0].slice(settings.prefix.length))
      {
        case "help":
          bot.reply(message, "`" + settings.prefix + "winner [id]` 33-4達成者の情報を確認できます.");
          break;
        case "winner":
          bot.reply(message, winnerInfo(cmd.length < 2 ? null : cmd[1]));
          break;
        case "force":
          console.log("admin? : " + settings.admin.includes(msg.user));
          if (settings.admin.includes(message.user))
          {
            if (cmd.length < 2)
            {
              bot.reply(message, "引数が足りません.\n(`" + settings.prefix + "help`でヘルプを確認できます.");
            } else
            {
              bot.sendEphemeral({
                channel: message.channel,
                user: message.user,
                text: forceHanshin(cmd[1])
              });
            }
          }
          break;
        default:
          bot.reply(message, msg + " : コマンドが見つかりません.\n(`" + settings.prefix + "help`でヘルプを確認できます.");
          break;
      }

      return;
    }

    if (msg == "33-4")
    {
      bot.reply(message, "なんでや！阪神関係ないやろ！");
      return;
    }
  
    const re_fb = msg.toLowerCase().match(/^fizzbuzz ([0-9\+\-\*\/\(\)]+)$/);
    if (re_fb != null)
    {
      re_fb.forEach(elm =>
      {
        let v = expr_to_v(elm);
        if (v == null) return;
        v = math.min(v, 100);
        const res_fb = [...Array(v).keys()].map(n => (++n % 3 ? '' : 'Fizz') + (n % 5 ? '' : 'Buzz') || str_to_hanshin("" + n)).join('\n');
        bot.reply(message, res_fb);
      });
      return;
    }
  
    let _res = str_to_dice(msg);
    let res = str_to_hanshin(_res);
    
    if (_res != msg && res == null) {res = _res;console.log("res = _res");}

    console.log("_res: " + _res);
    console.log("res: " + res);

    if (res == null)
    {
      if (msg.includes("時") || msg.includes("日"))
      {
        const text = str_to_hanshin(fmtDate());
        if (text != null) bot.reply(message, text);
      }
    } else
    {
      if (res == "⚂⚂-⚃")
      {
        // 33-4!
        bot.api.users.info({ user: message.user }, (err, result) =>
        {
          const userName = result.user.name;
          console.log("userName: " + userName);
          const num = hanshin.addWinner(userName);
          
          let text = res + "\n";
          text += ":tada: なんでや！阪神関係ないやろ！ :tada:\n";
          text += `(おめでとうございます！あなたは ${str_to_hanshin(num)} 人目の33-4達成者です！)`;

          bot.reply(message, text);
        });
      } else
      {
        bot.reply(message, res); 
      }
    }
    
  });
});

const winnerInfo = (id) =>
{
  if (id != null)
  {
    const winner = hanshin.getWinner(id);
    if (winner != null)
    {
        const updated = fmtDate(new Date(winner.updated));
        return `${id}さんの記録\n回数: ${winner.count} 回\n最終日時: ${updated}`;
    }
    else
    {
        return "まだ33-4を達成していない人のようです.";
    }
  } else
  {
    const latest = hanshin.getLatestWinner();
    if (latest.count == 0)
    {
        return "これまで33-4を達成した人はいません.";
    }
    else
    {
        const latest_winner = hanshin.getWinner(latest.id);
        const latest_date = fmtDate(new Date(latest_winner.updated));
        return `これまでの達成者\n人数: ${latest.count}人\n最後に達成した人: ${latest.id}さん\n回数: ${latest_winner.count}回\n日時: ${latest_date}`;
    }
  }
}

const forceHanshin = (expr) =>
{
  const n = hanshin.set(expr, true);
  return `${n} -> ${expr}: 正常に変更されました.`;
}
