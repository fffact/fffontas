
// GLOBALS (?)
let db, draft, conso;

function buildDraft () {
    const container = document.querySelector('#draft');

    const hot = new Handsontable(container, {
        dataSchema: {wday: null, from: null, to: null},
        colHeaders: ['GIORNO', 'DALLE', 'ALLE'],
        rowHeaders: (visualRowIndex) => visualRowIndex,
        afterChange: afterChangeHandler,
        minRows: 5,
        minSpareRows: 1,
        licenseKey: 'non-commercial-and-evaluation'
    });

    return hot;
}

function buildConso () {
    const container = document.querySelector('#conso');

    const hot = new Handsontable(container, {
        dataSchema: {wday: null, from: null, to: null},
        colHeaders: ['GIORNO', 'DALLE', 'ALLE'],
        rowHeaders: (visualRowIndex) => visualRowIndex,
        minRows: 5,
        licenseKey: 'non-commercial-and-evaluation'
    });

    return hot;
}

function afterChangeHandler (changes, source) {
    console.log('handler', changes, source);
    if (['edit', 'CopyPaste.cut', 'CopyPaste.paste'].includes(source)) {
        // we respond to user input AND NOT to `populateFromArray`
        for (const c of changes) {
            const [id, prop,, value] = c;
            // console.log({id, prop, value});

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
}

function getRowsFromDB () {
    return db.workingHours.orderBy('id').toArray()
    .then((rows) => {
        const r = rows.map((row) => [row.wday, row.from, row.to]);
        return r;
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
        const [, h0, m0] = match.map(e => parseInt(e));
        if (!(h0 >= 0 && h0 < 24 && m0 >= 0 && m0 < 60)) {
            throw new Error(`Malformed from at row ${row.id}, out of range`);
        }

        match = row.to.match(/(\d\d*):(\d\d)/);
        if (!match) throw new Error(`Malformed to at row ${row.id}`);
        const [, h1, m1] = match.map(e => parseInt(e));
        if (!(h1 >= 0 && h1 < 24 && m1 >= 0 && m1 < 60)) {
            throw new Error(`Malformed to at row ${row.id}, out of range`);
        }

        if ((h0 * 60 + m0) >= (h1 * 60 + m1)) {
            console.log(h0, m0, h1, m1);
            throw new Error(`Malformed duration at row ${row.id}`);
        }

        // row is valid
        row.linearTimeWeekly = wdayIndex * 1440 + h0 * 60 + m0;
        return true;
        
    } catch (error) {
        console.error(error);
        return false;
    }
}

function getValidatedRows () {
    const wellFormed = [];
    
    return db.workingHours.orderBy('id').toArray()
    .then((rows) => {
        for (const r of rows) {
            const v = validateRow(r);
            if (v) wellFormed.push(r);
        }
        return wellFormed;
    })
    .then((rows) => {
        const sorted = rows.sort((a, b) => a.linearTimeWeekly - b.linearTimeWeekly).map(e => [e.wday, e.from, e.to]);
        return sorted;
    })
    .catch(e => console.error(e));
}

function enterDraftMode () {
    console.log('enter draft mode');

    Alpine.store('ui').mode = 'draft';
}

function enterConsoMode () {
    console.log('enter conso mode');

    // remove empty row from db?

    getValidatedRows()
    .then((rows) => {
        conso.clear();
        if (rows.length > 0) conso.populateFromArray(0, 0, rows);
        conso.deselectCell();
    })
    .catch(e => console.error(e));
    Alpine.store('ui').mode = 'conso';
}

function test () {
    conso.clear();
}

// MAIN
function main () {
    
    // init dexie
    db = new Dexie('fffontas');
    db.version(1).stores({
        workingHours: 'id'
    });

    // init draft view
    draft = buildDraft();
    getRowsFromDB()
    .then((rows) => {
        draft.populateFromArray(0, 0, rows);
    })
    .catch(e => console.error(e));

    // init conso view
    conso = buildConso();

    // enterDraftMode();
}


if (document.readyState === "loading") {
    // Loading hasn't finished yet
    document.addEventListener("DOMContentLoaded", main);
} else {
    // `DOMContentLoaded` has already fired
    main();
}



  