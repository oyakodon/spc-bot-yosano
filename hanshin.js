import fs from "fs";
import math from "mathjs";

export default class Hanshin
{
    constructor(path = "./db/hanshin.json")
    {
        this.path = path;
        try
        {
            this.load();
        } catch(err)
        {
            this.db = JSON.parse(`{ "hash": { "334": "334" }, "winner": {} }`);
            this.save();
        }

        math.config({
            number: "BigNumber",
            precision: 64
        });
    }

    isValid(expr)
    {
        const re = /^[34\+\-\*\/\(\)\!\(sqrt)]+$/;
        if (!re.test(expr)) return false;

        let arr = "334";
        let count = 0;

        for (let i = 0; i < expr.length; i++)
        {
            if (expr[i] == '3' || expr[i] == '4')
            {
                if (expr[i] != arr[count]) return false;

                count = (count + 1) % 3;
            }
        }

        if (count != 0) return false;

        try
        {
            math.eval(expr);
        }
        catch (e)
        {
            return false;
        }

        return true;
    }

    addWinner(id)
    {
        if (id in this.db.winner)
        {
            this.db.winner[id].count++;
            this.db.winner[id].updated = new Date();
        } else
        {
            let winner = { "count": 1, "updated": new Date() };
            this.db.winner[id] = winner;
        }

        this.save();
        return Object.keys(this.db.winner).length;
    }

    getWinner(id)
    {
        return id in this.db.winner ? this.db.winner[id] : null;
    }

    getLatestWinner()
    {
        let ret = {"count": Object.keys(this.db.winner).length, "id": null};

        if (Object.keys(this.db.winner).length > 0)
        {
            let latest = null;
            let _key = null;
            Object.keys(this.db.winner).forEach((key) =>
            {
                if (latest == null)
                {
                    latest = this.db.winner[key];
                    _key = key;
                }
                else
                {
                    const l = new Date(latest.updated);
                    const r = new Date(this.db.winner[key].updated);
                    if (l.getTime() < r.getTime())
                    {
                        latest = this.db.winner[key];
                        _key = key;
                    }
                }
            });
            ret.id = _key;
        }

        return ret;
    }

    compare(l, r)
    {
        // 33-4の数が少ない
        let lhs = (l.match(/4/g) || []).length;
        let rhs = (r.match(/4/g) || []).length;
        console.log("compare : rule1 = " + (lhs < rhs));
        if (lhs != rhs) return lhs < rhs;

        // sqrt, !の数が少ない
        lhs = (l.match(/sqrt/g) || []).length + (l.match(/!/g) || []).length;
        rhs = (r.match(/sqrt/g) || []).length + (r.match(/!/g) || []).length;
        console.log("compare : rule2 = " + (lhs < rhs));
        if (lhs != rhs) return lhs < rhs;

        // 長さが短い
        lhs = l.length - ((l.match(/sqrt/g) || []).length * 3);
        rhs = r.length - ((r.match(/sqrt/g) || []).length * 3);
        console.log("compare : rule3 = " + (lhs < rhs));
        return lhs < rhs;
    }

    set(expr, force = false)
    {
        if (!this.isValid(expr)) return null;
        console.log("pass");
        let n;
        try
        {
            const v = math.eval(expr);
            n = math.number(v);
            if (!math.isInteger(n))
            {
              return null;
            }
        }
        catch (e)
        {
            console.log(e);
            return null;
        }
        if (!force && n in this.db.hash && !this.compare(expr, this.db.hash[n])) return null;
        this.db.hash[n] = expr;
        this.save();
        return n;
    }

    get(n)
    {
        return n in this.db.hash ? this.db.hash[n] : null;
    }

    load()
    {
        this.db = JSON.parse(fs.readFileSync(this.path, "utf8"));
    }

    save()
    {
        fs.writeFileSync(this.path, JSON.stringify(this.db, null, '  '), 'utf8');
    }
}
