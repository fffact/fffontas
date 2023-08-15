
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
            }
        );
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
    // row should be {id: 1, wday: 'lun', from: '8:00', to: '9:00'}
    let h0, m0, h1, m1
    
    // validate wday
    const i = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom'].indexOf(row.wday);
    if (i >= 0) {
        row.linearTimeWeekly = i * 1440;
    } else {
        return false;
    }
    
    // validate from
    try {
        [h0, m0] = row.from.match(/(\d\d*):(\d\d)/).slice(1, 3).map(e => parseInt( e ));
        if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
            row.linearTimeWeekly += h * 60 + m;
        } else {
            return false;
        }
    } catch (error) {
        return false
    }
    

    return row
}

function consolidate () {
    const wellFormed = [];
    
    db.workingHours.orderBy('id').toArray()
        .then((rows) => {
            for (const r of rows) {
                const v = validateRow(r);
                if (v) wellFormed.push(v);
            }
            console.log(wellFormed);
        })
        .catch(e => console.error(e));
}
  
// MAIN
async function main () {
    db = new Dexie('fffontas');

    db.version(1).stores({
        workingHours: 'id'
    });
    
    editor = buildEditor();
    editor.addHook('afterChange', _afterChange);
}


if (document.readyState === "loading") {
    // Loading hasn't finished yet
    document.addEventListener("DOMContentLoaded", main);
} else {
    // `DOMContentLoaded` has already fired
    main();
}



  