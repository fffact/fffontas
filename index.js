
// GLOBALS (?)
let db, editor;

function buildEditor () {
    const container = document.querySelector('#editor');

    const hot = new Handsontable(container, {
        dataSchema: {wday: null, from: null, to: null},
        colHeaders: ['GIORNO', 'DALLE', 'ALLE'],
        rowHeaders: (visualRowIndex) => visualRowIndex,
        licenseKey: 'non-commercial-and-evaluation'
    });

    return hot;
}

function _afterChange (changes) {
    for (const c of changes) {
        const [id, prop,, value] = c;
        console.log({id, prop, value});

        db.workingHours.update(id, {[prop]: value})
        .then((updated) => {
            if (!updated) {
                // id doesn't exist
                db.workingHours.add({id, [prop]: value});
            }
        })
        .catch(e => console.error(e));
    }
}

function test () {
    console.log('test');
}

function loadFromDB () {
    db.workingHours.orderBy('id').toArray()
    .then((rows) => {
        const r = rows.map((row) => [row.wday, row.from, row.to]);
        editor.populateFromArray(0, 0, r);
    })
    .catch(e => console.error(e));
}

function validateRow (row) {
    try {
        if (!(row.wday && row.from && row.to)) {
            throw new Error(`Missing prop at row ${row.id}`);
        };

        const wdayIndex = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'].indexOf(row.wday);
        if (wdayIndex < 0) throw new Error(`Malformed wday at row ${row.id}`);

        let match = row.from.match(/(\d\d*):(\d\d)/);
        if (!match) throw new Error(`Malformed from at row ${row.id}`);
        const [, h0, m0] = match;
        if (!(h0 >= 0 && h0 < 24 && m0 >= 0 && m0 < 60)) {
            throw new Error(`Malformed from at row ${row.id}, out of range`);
        }

        match = row.to.match(/(\d\d*):(\d\d)/);
        if (!match) throw new Error(`Malformed to at row ${row.id}`);
        const [, h1, m1] = match;
        if (!(h1 >= 0 && h1 < 24 && m1 >= 0 && m1 < 60)) {
            throw new Error(`Malformed to at row ${row.id}, out of range`);
        }

        if ((h0 * 60 + m0) >= (h1 * 60 + m1)) throw new Error(`Malformed duration at row ${row.id}`);

        // row is valid
        row.linearTimeWeekly = wdayIndex * 1440 + h0 * 60 + m0;
        return true;
        
    } catch (error) {
        console.error(error);
        return false;
    }
}

function consolidate () {
    const wellFormed = [];
    
    db.workingHours.orderBy('id').toArray()
    .then((rows) => {
        for (const r of rows) {
            const v = validateRow(r);
            if (v) wellFormed.push(r);
        }
        return wellFormed;
    })
    .then((rows) => {
        const sorted = rows.sort((a, b) => a.linearTimeWeekly - b.linearTimeWeekly).map(e => [e.wday, e.from, e.to]);
        console.log(sorted);
        editor.removeHook('afterChange', _afterChange);
        editor.clear();
        editor.populateFromArray(0, 0, sorted);

    })
    .catch(e => console.error(e));
}
  
// MAIN
function main () {
    db = new Dexie('fffontas');

    db.version(1).stores({
        workingHours: 'id'
    });
    
    editor = buildEditor();
    editor.addHook('afterChange', _afterChange);
    loadFromDB();
}


if (document.readyState === "loading") {
    // Loading hasn't finished yet
    document.addEventListener("DOMContentLoaded", main);
} else {
    // `DOMContentLoaded` has already fired
    main();
}



  