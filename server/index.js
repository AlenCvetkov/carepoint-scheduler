import { createServer } from 'node:http'
import { mkdirSync } from 'node:fs'
import { readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dataDirectory = path.join(projectRoot, 'data')
const databasePath = path.join(dataDirectory, 'carepoint.sqlite')
const port = Number(process.env.PORT ?? 3001)
const allowedDurations = new Set([15, 30, 45, 60, 90, 120])

mkdirSync(dataDirectory, { recursive: true })
const database = new DatabaseSync(databasePath)
database.exec(`
  CREATE TABLE IF NOT EXISTS doctors (
    id INTEGER PRIMARY KEY,
    full_name TEXT NOT NULL,
    speciality TEXT NOT NULL
  );
  PRAGMA foreign_keys = ON;
  PRAGMA journal_mode = WAL;

  CREATE TABLE IF NOT EXISTS time_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    doctor_id INTEGER REFERENCES doctors(id),
    date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    duration_minutes INTEGER NOT NULL CHECK (duration_minutes IN (15, 30, 45, 60, 90, 120)),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    slot_id INTEGER NOT NULL UNIQUE REFERENCES time_slots(id) ON DELETE CASCADE,
    patient_name TEXT NOT NULL,
    patient_email TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TRIGGER IF NOT EXISTS prevent_overlapping_slots
  BEFORE INSERT ON time_slots
  BEGIN
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM time_slots existing
      WHERE existing.date = NEW.date
        AND CAST(substr(existing.start_time, 1, 2) AS INTEGER) * 60
            + CAST(substr(existing.start_time, 4, 2) AS INTEGER)
            < CAST(substr(NEW.start_time, 1, 2) AS INTEGER) * 60
              + CAST(substr(NEW.start_time, 4, 2) AS INTEGER)
              + NEW.duration_minutes
        AND CAST(substr(existing.start_time, 1, 2) AS INTEGER) * 60
            + CAST(substr(existing.start_time, 4, 2) AS INTEGER)
            + existing.duration_minutes
            > CAST(substr(NEW.start_time, 1, 2) AS INTEGER) * 60
              + CAST(substr(NEW.start_time, 4, 2) AS INTEGER)
    ) THEN RAISE(ABORT, 'overlapping_slot') END;
  END;
`)

const timeSlotColumns = database.prepare('PRAGMA table_info(time_slots)').all()
if (!timeSlotColumns.some((column) => column.name === 'doctor_id')) {
  database.exec('ALTER TABLE time_slots ADD COLUMN doctor_id INTEGER REFERENCES doctors(id)')
}
database.exec(`
  DROP TRIGGER IF EXISTS prevent_overlapping_slots;
  CREATE TRIGGER prevent_overlapping_slots
  BEFORE INSERT ON time_slots
  BEGIN
    SELECT CASE WHEN EXISTS (
      SELECT 1 FROM time_slots existing
      WHERE existing.date = NEW.date
        AND existing.doctor_id IS NEW.doctor_id
        AND CAST(substr(existing.start_time, 1, 2) AS INTEGER) * 60
            + CAST(substr(existing.start_time, 4, 2) AS INTEGER)
            < CAST(substr(NEW.start_time, 1, 2) AS INTEGER) * 60
              + CAST(substr(NEW.start_time, 4, 2) AS INTEGER)
              + NEW.duration_minutes
        AND CAST(substr(existing.start_time, 1, 2) AS INTEGER) * 60
            + CAST(substr(existing.start_time, 4, 2) AS INTEGER)
            + existing.duration_minutes
            > CAST(substr(NEW.start_time, 1, 2) AS INTEGER) * 60
              + CAST(substr(NEW.start_time, 4, 2) AS INTEGER)
    ) THEN RAISE(ABORT, 'overlapping_slot') END;
  END;
`)
database.exec([
  "DROP TRIGGER IF EXISTS prevent_overlapping_slot_updates;",
  "CREATE TRIGGER prevent_overlapping_slot_updates",
  "BEFORE UPDATE OF date, start_time, duration_minutes, doctor_id ON time_slots",
  "BEGIN",
  "  SELECT CASE WHEN EXISTS (",
  "    SELECT 1 FROM time_slots existing",
  "    WHERE existing.id <> OLD.id",
  "      AND existing.date = NEW.date",
  "      AND existing.doctor_id IS NEW.doctor_id",
  "      AND CAST(substr(existing.start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(existing.start_time, 4, 2) AS INTEGER)",
  "          < CAST(substr(NEW.start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(NEW.start_time, 4, 2) AS INTEGER) + NEW.duration_minutes",
  "      AND CAST(substr(existing.start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(existing.start_time, 4, 2) AS INTEGER) + existing.duration_minutes",
  "          > CAST(substr(NEW.start_time, 1, 2) AS INTEGER) * 60 + CAST(substr(NEW.start_time, 4, 2) AS INTEGER)",
  "  ) THEN RAISE(ABORT, 'overlapping_slot') END;",
  "END;",
].join('\n'))
const bookingColumns = database.prepare('PRAGMA table_info(bookings)').all()
if (!bookingColumns.some((column) => column.name === 'description')) {
  database.exec("ALTER TABLE bookings ADD COLUMN description TEXT NOT NULL DEFAULT ''")
}
const initialDoctors = [
  [1, 'Marko Gonev', 'Neurolog'],
  [2, 'Kiril Trajcev', 'Neurolog'],
  [3, 'Teodor Dimitrievski', 'Neurolog'],
  [4, 'Anastasija Paneva', 'Dermatolog'],
  [5, 'Melanija Gosheva', 'Dermatolog'],
  [6, 'Petar Panev', 'Dermatolog'],
  [7, 'Anastasija Todorova', 'Dermatolog'],
  [8, 'Pavel Monev', 'Stomatolog'],
  [9, 'Vlatko Petrov', 'Stomatolog'],
  [10, 'Pavel Todorov', 'Kardiolog'],
  [11, 'Gorjan Panchev', 'Kardiolog'],
  [12, 'Pavlina Nikolovska', 'Kardiolog'],
  [13, 'Maja Ancheva', 'Urolog'],
  [14, 'Nikola Manchev', 'Urolog'],
  [15, 'Boban Bobanov', 'Ortoped'],
  [16, 'Marija Pavlova', 'Ortoped'],
  [17, 'Bojana Dimcheva', 'Ortoped'],
]
const insertDoctor = database.prepare(
  'INSERT OR IGNORE INTO doctors (id, full_name, speciality) VALUES (?, ?, ?)',
)
for (const doctor of initialDoctors) insertDoctor.run(...doctor)

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  })
  response.end(JSON.stringify(value))
}

async function readJson(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 1_000_000) throw new Error('Барањето е преголемо.')
    chunks.push(chunk)
  }
  let body
  try {
    body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new Error('Испратениот JSON не е исправен.')
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('Барањето мора да содржи JSON објект.')
  }
  return body
}

function isRealDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const [year, month, day] = value.split('-').map(Number)
  const candidate = new Date(year, month - 1, day)
  return candidate.getFullYear() === year && candidate.getMonth() === month - 1 && candidate.getDate() === day
}

function isValidStart(date, time) {
  const selected = new Date(`${date}T${time}:00`)
  return Number.isFinite(selected.getTime()) && selected.getTime() >= Date.now()
}

function minutesOf(time) {
  const [hours, minutes] = time.split(':').map(Number)
  return hours * 60 + minutes
}

function validateSlotInput(body) {
  const { date, startTime } = body
  const durationMinutes = Number(body.durationMinutes)
  const doctorId = Number(body.doctorId)

  if (!isRealDate(date) || typeof startTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(startTime)) {
    return { error: 'Изберете исправен датум и време.' }
  }
  if (!Number.isInteger(doctorId)
    || !database.prepare('SELECT 1 FROM doctors WHERE id = ?').get(doctorId)) {
    return { error: 'Изберете валиден доктор.' }
  }
  if (!allowedDurations.has(durationMinutes)) {
    return { error: 'Изберете дозволено времетраење.' }
  }

  const startMinutes = minutesOf(startTime)
  if (startMinutes < 8 * 60 || startMinutes >= 15 * 60
    || startMinutes + durationMinutes > 15 * 60) {
    return { error: 'Термините мора да бидат во периодот од 08:00 до 15:00.' }
  }
  if (!isValidStart(date, startTime)) {
    return { error: 'Не може да објавите термин во минатото.' }
  }

  return { values: { date, startTime, durationMinutes, doctorId } }
}


async function serveFrontend(request, response, pathname) {
  const distRoot = path.join(projectRoot, 'dist')
  let requestedPath
  try {
    requestedPath = decodeURIComponent(pathname)
  } catch {
    sendJson(response, 400, { error: 'Невалидна адреса.' })
    return
  }
  const safePath = path.resolve(distRoot, `.${requestedPath}`)
  if (!safePath.startsWith(`${distRoot}${path.sep}`) && safePath !== distRoot) {
    sendJson(response, 403, { error: 'Пристапот е одбиен.' })
    return
  }
  let filePath = safePath
  try {
    const fileInfo = await stat(filePath)
    if (fileInfo.isDirectory()) filePath = path.join(filePath, 'index.html')
  } catch {
    filePath = path.join(distRoot, 'index.html')
  }
  let content
  try {
    content = await readFile(filePath)
  } catch {
    sendJson(response, 404, { error: 'Прво изгради ја апликацијата со npm run build.' })
    return
  }
  const extension = path.extname(filePath)
  const contentTypes = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
  }
  response.writeHead(200, {
    'content-type': contentTypes[extension] ?? 'application/octet-stream',
    'cache-control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
  })
  response.end(content)
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? 'localhost'}`)
  const { pathname } = url

  if (pathname === '/api/health' && request.method === 'GET') {
    sendJson(response, 200, { status: 'ok', storage: 'sqlite' })
    return
  }

  if (pathname === '/api/doctors' && request.method === 'GET') {
    const doctors = database.prepare(`
      SELECT id, full_name AS fullName, speciality
      FROM doctors
      ORDER BY id
    `).all()
    sendJson(response, 200, doctors)
    return
  }
  if (pathname === '/api/slots' && request.method === 'GET') {
    const slots = database.prepare(`
      SELECT
        time_slots.id,
        time_slots.doctor_id AS doctorId,
        time_slots.date,
        time_slots.start_time AS startTime,
        time_slots.duration_minutes AS durationMinutes,
        EXISTS(SELECT 1 FROM bookings WHERE bookings.slot_id = time_slots.id) AS isBooked
      FROM time_slots
      ORDER BY time_slots.date, time_slots.start_time
    `).all().map((slot) => ({ ...slot, isBooked: Boolean(slot.isBooked) }))
    sendJson(response, 200, slots)
    return
  }

  if (pathname === '/api/slots' && request.method === 'POST') {
    let body
    try {
      body = await readJson(request)
    } catch (error) {
      sendJson(response, 400, { error: error.message })
      return
    }

    const validation = validateSlotInput(body)
    if (validation.error) {
      sendJson(response, 400, { error: validation.error })
      return
    }
    const { date, startTime, durationMinutes, doctorId } = validation.values

    try {
      const result = database.prepare(
        'INSERT INTO time_slots (date, start_time, duration_minutes, doctor_id) VALUES (?, ?, ?, ?)',
      ).run(date, startTime, durationMinutes, doctorId)
      sendJson(response, 201, {
        id: Number(result.lastInsertRowid), doctorId, date, startTime,
        durationMinutes, isBooked: false,
      })
    } catch (error) {
      const isOverlap = String(error.message).includes('overlapping_slot')
      sendJson(response, 409, {
        error: isOverlap
          ? 'Овој термин се преклопува со друг термин кај истиот доктор.'
          : 'Терминот не може да се објави.',
      })
    }
    return
  }

  const slotResourceMatch = pathname.match(/^\/api\/slots\/(\d+)$/)

  if (slotResourceMatch && request.method === 'PATCH') {
    const slotId = Number(slotResourceMatch[1])
    if (!Number.isInteger(slotId) || slotId < 1) {
      sendJson(response, 400, { error: 'Изберете валиден термин.' })
      return
    }

    let body
    try {
      body = await readJson(request)
    } catch (error) {
      sendJson(response, 400, { error: error.message })
      return
    }

    const validation = validateSlotInput(body)
    if (validation.error) {
      sendJson(response, 400, { error: validation.error })
      return
    }

    const slot = database.prepare(
      'SELECT id, EXISTS(SELECT 1 FROM bookings WHERE bookings.slot_id = time_slots.id) AS isBooked FROM time_slots WHERE id = ?',
    ).get(slotId)
    if (!slot) {
      sendJson(response, 404, { error: 'Терминот не е пронајден.' })
      return
    }
    if (slot.isBooked) {
      sendJson(response, 409, { error: 'Резервиран термин не може да се менува.' })
      return
    }

    const { date, startTime, durationMinutes, doctorId } = validation.values
    try {
      database.prepare(
        'UPDATE time_slots SET date = ?, start_time = ?, duration_minutes = ?, doctor_id = ? WHERE id = ?',
      ).run(date, startTime, durationMinutes, doctorId, slotId)
      sendJson(response, 200, {
        id: slotId, doctorId, date, startTime, durationMinutes, isBooked: false,
      })
    } catch (error) {
      const isOverlap = String(error.message).includes('overlapping_slot')
      sendJson(response, 409, {
        error: isOverlap
          ? 'Овој термин се преклопува со друг термин кај истиот доктор.'
          : 'Промените не може да се зачуваат.',
      })
    }
    return
  }

  if (slotResourceMatch && request.method === 'DELETE') {
    const slotId = Number(slotResourceMatch[1])
    if (!Number.isInteger(slotId) || slotId < 1) {
      sendJson(response, 400, { error: 'Изберете валиден термин.' })
      return
    }

    const slot = database.prepare(
      'SELECT id, EXISTS(SELECT 1 FROM bookings WHERE bookings.slot_id = time_slots.id) AS isBooked FROM time_slots WHERE id = ?',
    ).get(slotId)
    if (!slot) {
      sendJson(response, 404, { error: 'Терминот не е пронајден.' })
      return
    }
    if (slot.isBooked) {
      sendJson(response, 409, { error: 'Резервиран термин не може да се избрише.' })
      return
    }

    database.prepare('DELETE FROM time_slots WHERE id = ?').run(slotId)
    sendJson(response, 200, { id: slotId, deleted: true })
    return
  }

  if (pathname === '/api/bookings' && request.method === 'POST') {
    let body
    try {
      body = await readJson(request)
    } catch (error) {
      sendJson(response, 400, { error: error.message })
      return
    }
    const slotId = Number(body.slotId)
    const patientName = typeof body.patientName === 'string' ? body.patientName.trim() : ''
    const patientEmail = typeof body.patientEmail === 'string' ? body.patientEmail.trim().toLowerCase() : ''
    const description = typeof body.description === 'string' ? body.description.trim() : ''
    if (!Number.isInteger(slotId) || slotId < 1) {
      sendJson(response, 400, { error: 'Изберете валиден термин.' })
      return
    }
    if (patientName.length < 2 || patientName.length > 100) {
      sendJson(response, 400, { error: 'Името треба да содржи од 2 до 100 знаци.' })
      return
    }
    if (patientEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(patientEmail)) {
      sendJson(response, 400, { error: 'Внесете валидна email адреса.' })
      return
    }
    if (description.length > 1000) {
      sendJson(response, 400, { error: 'Описот може да содржи најмногу 1000 знаци.' })
      return
    }
    try {
      const slot = database.prepare(`
        SELECT id, date, start_time AS startTime
        FROM time_slots WHERE id = ?
      `).get(slotId)
      if (!slot) {
        sendJson(response, 404, { error: 'Терминот не е пронајден.' })
        return
      }
      if (!isValidStart(slot.date, slot.startTime)) {
        sendJson(response, 409, { error: 'Овој термин е поминат и не може да се резервира.' })
        return
      }
      const result = database.prepare(`
        INSERT INTO bookings (slot_id, patient_name, patient_email, description)
        VALUES (?, ?, ?, ?)
      `).run(slotId, patientName, patientEmail, description)
      const createdAt = database.prepare(
        'SELECT created_at AS createdAt FROM bookings WHERE id = ?',
      ).get(result.lastInsertRowid).createdAt
      sendJson(response, 201, {
        id: Number(result.lastInsertRowid), slotId, patientName, patientEmail, description, createdAt,
      })
    } catch (error) {
      const isAlreadyBooked = String(error.message).includes('UNIQUE constraint failed')
      sendJson(response, isAlreadyBooked ? 409 : 400, {
        error: isAlreadyBooked
          ? 'Некој друг веќе го резервираше овој термин. Изберете друг.'
          : 'Резервацијата не успеа.',
      })
    }
    return
  }

  if (pathname.startsWith('/api/')) {
    sendJson(response, 404, { error: 'API патеката не постои.' })
    return
  }

  if (request.method === 'GET' || request.method === 'HEAD') {
    await serveFrontend(request, response, pathname)
    return
  }

  sendJson(response, 405, { error: 'Методот не е дозволен.' })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`Carepoint API is running at http://localhost:${port}`)
  console.log(`SQLite database: ${databasePath}`)
})

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close(() => {
      database.close()
      process.exit(0)
    })
  })
}







