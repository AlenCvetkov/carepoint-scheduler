import {useEffect, useState, type FormEvent} from 'react'
import type {CreateBookingInput, CreateSlotInput, TimeSlot} from './types/booking'
import {SPECIALITIES, type Doctor} from './data/mockData'
import './App.css'

type ActiveTab = 'schedule' | 'publish'
type Notice = { kind: 'success' | 'error'; message: string }

function getToday() {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
}

function formatDate(date: string) {
    return new Intl.DateTimeFormat('mk-MK', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    }).format(new Date(`${date}T12:00:00`))
}

function App() {
    const [slots, setSlots] = useState<TimeSlot[]>([])
    const [doctors, setDoctors] = useState<Doctor[]>([])
    const [publishSpeciality, setPublishSpeciality] = useState('')
    const [publishDoctorId, setPublishDoctorId] = useState('')
    const [scheduleSpeciality, setScheduleSpeciality] = useState('')
    const [scheduleDoctorId, setScheduleDoctorId] = useState('')
    const [activeTab, setActiveTab] = useState<ActiveTab>('schedule')
    const [selectedDate, setSelectedDate] = useState('')
    const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null)
    const [patientName, setPatientName] = useState('')
    const [patientEmail, setPatientEmail] = useState('')
    const [description, setDescription] = useState('')
    const [slotDate, setSlotDate] = useState('')
    const [slotStartTime, setSlotStartTime] = useState('08:00')
    const [slotDuration, setSlotDuration] = useState(30)
    const [notice, setNotice] = useState<Notice | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)

    async function loadSlots() {
        try {
            const response = await fetch('/api/slots')
            if (!response.ok) throw new Error('Не може да се вчита распоредот.')
            const data: TimeSlot[] = await response.json()
            setSlots(data)
        } catch (error) {
            setNotice({
                kind: 'error',
                message: error instanceof Error ? error.message : 'Настана грешка.',
            })
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        let isActive = true

        async function loadInitialData() {
            try {
                const [slotsResponse, doctorsResponse] = await Promise.all([
                    fetch('/api/slots'),
                    fetch('/api/doctors'),
                ])
                if (!slotsResponse.ok || !doctorsResponse.ok) {
                    throw new Error('Не може да се вчита распоредот и листата на доктори.')
                }

                const [slotData, doctorData]: [TimeSlot[], Doctor[]] = await Promise.all([
                    slotsResponse.json(),
                    doctorsResponse.json(),
                ])
                if (isActive) {
                    setSlots(slotData)
                    setDoctors(doctorData)
                }
            } catch (error) {
                if (isActive) {
                    setNotice({
                        kind: 'error',
                        message: error instanceof Error ? error.message : 'Настана грешка.',
                    })
                }
            } finally {
                if (isActive) setIsLoading(false)
            }
        }

        void loadInitialData()
        return () => {
            isActive = false
        }
    }, [])

    const filteredPublishDoctors = doctors.filter(
        (doctor) => doctor.speciality === publishSpeciality,
    )

    const filteredScheduleDoctors = doctors.filter(
        (doctor) => doctor.speciality === scheduleSpeciality,
    )

    const visibleSlots = slots.filter((slot) => {
        const doctor = doctors.find((item) => item.id === slot.doctorId)
        const matchesDate = !selectedDate || slot.date === selectedDate
        const matchesSpeciality = !scheduleSpeciality || doctor?.speciality === scheduleSpeciality
        const matchesDoctor = !scheduleDoctorId || String(slot.doctorId) === scheduleDoctorId
        return matchesDate && matchesSpeciality && matchesDoctor
    })
    const availableCount = slots.filter((slot) => !slot.isBooked).length
    const bookedCount = slots.length - availableCount

    async function handlePublish(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        setIsSaving(true)
        setNotice(null)

        const newSlot: CreateSlotInput = {
            date: slotDate,
            startTime: slotStartTime,
            durationMinutes: slotDuration,
            doctorId: Number(publishDoctorId),
        }

        try {
            const response = await fetch('/api/slots', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(newSlot),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error ?? 'Терминот не може да се објави.')
            setNotice({kind: 'success', message: 'Терминот е објавен.'})
            setSlotDate('')
            await loadSlots()
        } catch (error) {
            setNotice({
                kind: 'error',
                message: error instanceof Error ? error.message : 'Настана грешка.',
            })
        } finally {
            setIsSaving(false)
        }
    }

    async function handleBooking(event: FormEvent<HTMLFormElement>) {
        event.preventDefault()
        if (!selectedSlot) return

        setIsSaving(true)
        setNotice(null)
        const newBooking: CreateBookingInput = {
            slotId: selectedSlot.id,
            patientName,
            patientEmail,
            description,
        }

        try {
            const response = await fetch('/api/bookings', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(newBooking),
            })
            const result = await response.json()
            if (!response.ok) throw new Error(result.error ?? 'Резервацијата не успеа.')
            setNotice({kind: 'success', message: 'Терминот е резервиран.'})
            setSelectedSlot(null)
            setPatientName('')
            setPatientEmail('')
            setDescription('')
            await loadSlots()
        } catch (error) {
            setNotice({
                kind: 'error',
                message: error instanceof Error ? error.message : 'Настана грешка.',
            })
            await loadSlots()
        } finally {
            setIsSaving(false)
        }
    }

    return (
        <div className="app-shell">
            <header className="site-header">
                <a className="brand" href="#top" aria-label="Carepoint почетна">
                    <span className="brand-symbol"><span/></span>
                    carepoint<span className="brand-period">.</span>
                </a>

            </header>

            <section className="hero" id="top">
                <div className="hero-content">
                    <p className="eyebrow"><span className="eyebrow-line"/>ГРИЖА ШТО СЕ ВКЛОПУВА ВО ВАШЕТО ВРЕМЕ</p>
                    <h1>Здравјето<br/>почнува со <em>грижа.</em></h1>
                  <a className="primary-link" style={{ marginTop: '16px', display: 'inline-block' }} href="#schedule">Погледни термини <span>→</span></a>

                </div>
                <div className="hero-visual" aria-hidden="true">
                    <div className="visual-ring ring-large"/>
                    <div className="visual-ring ring-small"/>
                    <div className="visual-orbit"/>
                    <div className="visual-calendar">
                        <div className="calendar-top"><span/><span/><span/></div>
                        <div className="calendar-heading">
                            <div><small>ТВОЈОТ РАСПОРЕД</small><strong>Слободни термини</strong></div>
                            <span className="calendar-check">✓</span></div>
                        <div className="calendar-grid"><i>Пон</i><i>Вто</i><i className="selected-day">Сре</i><i>Чет</i><i>Пет</i><i>Саб</i><i>Нед</i><i>08:30</i><i
                            className="selected-day">10:00</i><i>11:30</i><i>13:00</i><i>14:00</i></div>
                    </div>
                    <span className="visual-cross cross-one">✳</span><span className="visual-cross cross-two">✳</span>
                    <div className="floating-note note-top"><span className="note-icon">◷</span><span><strong>Брзо закажување</strong><small>Изберете време онлајн</small></span>
                    </div>
                    <div className="floating-note note-bottom"><span className="note-avatar">✓</span><span><strong>Терминот е ваш</strong><small>Потврдено успешно</small></span>
                    </div>
                </div>
            </section>

            <section className="schedule-section" id="schedule">
                <div className="section-intro">
                    <div><p className="section-eyebrow">РАСПОРЕД</p><h2>Термини за преглед</h2></div>
                    <div className="schedule-stats">
                        <div className="stat-item"><strong className="stat-value">{availableCount}</strong><span
                            className="stat-label">слободни</span></div>
                        <span className="stat-divider"/>
                        <div className="stat-item"><strong className="stat-value muted-stat">{bookedCount}</strong><span
                            className="stat-label">резервирани</span></div>
                    </div>
                </div>

                {notice && <div className={`notice notice-${notice.kind}`} role="status"><span
                    className="notice-icon">{notice.kind === 'success' ? '✓' : '!'}</span>{notice.message}
                    <button type="button" aria-label="Затвори известување" onClick={() => setNotice(null)}>×</button>
                </div>}

                <div className="workspace-card">
                    <div className="workspace-toolbar">
                        <div className="tab-list" role="tablist" aria-label="Управување со термини">
                            <button className={`tab-button ${activeTab === 'schedule' ? 'active' : ''}`} type="button"
                                    role="tab" aria-selected={activeTab === 'schedule'}
                                    onClick={() => setActiveTab('schedule')}><span className="tab-icon">▦</span>Достапни
                                термини <span className="tab-count">{availableCount}</span></button>
                            <button className={`tab-button ${activeTab === 'publish' ? 'active' : ''}`} type="button"
                                    role="tab" aria-selected={activeTab === 'publish'}
                                    onClick={() => setActiveTab('publish')}><span className="tab-icon">＋</span>Објави
                                достапност
                            </button>
                        </div>
                        {activeTab === 'schedule' && <label className="date-filter">
                            <select aria-label="Филтрирај по специјалност" value={scheduleSpeciality}
                                    onChange={(event) => {
                                        setScheduleSpeciality(event.target.value);
                                        setScheduleDoctorId('')
                                    }}>
                                <option value="">Сите специјалности</option>
                                {SPECIALITIES.map((speciality) => <option key={speciality}
                                                                          value={speciality}>{speciality}</option>)}
                            </select>
                            {scheduleSpeciality && <select aria-label="Филтрирај по доктор" value={scheduleDoctorId}
                                                           onChange={(event) => setScheduleDoctorId(event.target.value)}>
                                <option value="">Сите доктори</option>
                                {filteredScheduleDoctors.map((doctor) => <option key={doctor.id}
                                                                                 value={doctor.id}>{doctor.fullName}</option>)}
                            </select>}
                            <input aria-label="Филтрирај по датум" type="date" min={getToday()} value={selectedDate}
                                   onChange={(event) => setSelectedDate(event.target.value)}/>
                            {selectedDate && <button type="button" onClick={() => setSelectedDate('')}>Исчисти</button>}
                        </label>}
                    </div>

                    {activeTab === 'schedule' ? (
                        <div className="slot-area">
                            {isLoading ?
                                <div className="loading-state"><span className="spinner"/>Се вчитува распоредот...
                                </div> : visibleSlots.length === 0 ? (
                                    <div className="empty-state">
                                        <div className="empty-illustration">▦<i>＋</i></div>
                                        <div>
                                            <h3>{selectedDate || scheduleSpeciality ? 'Нема термини за избраните филтри' : 'Сè уште нема објавени термини'}</h3>
                                            <p>Објавените слободни термини ќе се појават тука и ќе може да се
                                                резервираат.</p>
                                            <button className="text-action" type="button"
                                                    onClick={() => setActiveTab('publish')}>Објави
                                                достапност <span>→</span></button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="slot-grid">
                                        {visibleSlots.map((slot) => <article
                                            className={`slot-card ${slot.isBooked ? 'booked' : ''}`} key={slot.id}>
                                            <div className="slot-date"><span
                                                className="slot-weekday">{new Intl.DateTimeFormat('mk-MK', {weekday: 'short'}).format(new Date(`${slot.date}T12:00:00`))}</span><strong>{new Date(`${slot.date}T12:00:00`).getDate()}</strong><span
                                                className="slot-month">{new Intl.DateTimeFormat('mk-MK', {month: 'short'}).format(new Date(`${slot.date}T12:00:00`))}</span>
                                            </div>
                                            <div className="slot-info"><span
                                                className="slot-date-full">{formatDate(slot.date)}</span><strong
                                                className="slot-time"><span
                                                className="clock-icon">◷</span> {slot.startTime}</strong><span
                                                className="slot-duration">{doctors.find((doctor) => doctor.id === slot.doctorId)?.fullName ?? 'Доктор не е избран'}</span><span
                                                className="slot-duration">Преглед · {slot.durationMinutes} мин.</span>
                                            </div>
                                            {slot.isBooked ?
                                                <span className="booked-label"><span>✓</span>Резервиран</span> :
                                                <button className="book-button" type="button"
                                                        onClick={() => setSelectedSlot(slot)}>Резервирај <span>→</span>
                                                </button>}</article>)}
                                    </div>
                                )}
                            <div className="slot-area-footer"><span><i
                                className="legend-dot available-dot"/>Достапен</span><span><i
                                className="legend-dot booked-dot"/>Резервиран</span><span className="live-status"><i
                                className="pulse-dot"/>Распоредот се ажурира во живо</span></div>
                        </div>
                    ) : (
                        <div className="publish-panel">
                            <div className="publish-copy"><span className="publish-icon">＋</span><p
                                className="section-eyebrow">ЗА ДОКТОРСКИОТ ТИМ</p><h3>Објави слободен термин</h3>
                                <p>Изберете датум, време и времетраење. Посетителите ќе можат да го резервираат
                                    терминот.</p>
                                <div className="publish-hint"><span>ⓘ</span>Датумот се избира преку календарот. Може да
                                    објавите термини за кој било иден ден.
                                </div>
                            </div>
                            <form className="publish-form" onSubmit={handlePublish}>
                                <label className="form-field"><span>Специјалност <b>*</b></span><select required
                                                                                                        value={publishSpeciality}
                                                                                                        onChange={(event) => {
                                                                                                            setPublishSpeciality(event.target.value);
                                                                                                            setPublishDoctorId('')
                                                                                                        }}>
                                    <option value="">Избери специјалност</option>
                                    {SPECIALITIES.map((speciality) => <option key={speciality}
                                                                              value={speciality}>{speciality}</option>)}
                                </select></label>
                                {publishSpeciality &&
                                    <label className="form-field"><span>Доктор <b>*</b></span><select required
                                                                                                      value={publishDoctorId}
                                                                                                      onChange={(event) => setPublishDoctorId(event.target.value)}>
                                        <option value="">Избери доктор</option>
                                        {filteredPublishDoctors.map((doctor) => <option key={doctor.id}
                                                                                        value={doctor.id}>{doctor.fullName}</option>)}
                                    </select></label>} <label className="form-field"><span>Датум <b>*</b></span><input
                                required type="date" min={getToday()} value={slotDate}
                                onChange={(event) => setSlotDate(event.target.value)}/></label>
                                <div className="form-row"><label
                                    className="form-field"><span>Почеток <b>*</b></span><input required type="time"
                                                                                               min="08:00" max="15:00"
                                                                                               value={slotStartTime}
                                                                                               onChange={(event) => setSlotStartTime(event.target.value)}/></label><label
                                    className="form-field"><span>Времетраење <b>*</b></span><select value={slotDuration}
                                                                                                    onChange={(event) => setSlotDuration(Number(event.target.value))}>
                                    <option value={15}>15 мин.</option>
                                    <option value={30}>30 мин.</option>
                                    <option value={45}>45 мин.</option>
                                    <option value={60}>60 мин.</option>
                                    <option value={90}>90 мин.</option>
                                    <option value={120}>120 мин.</option>
                                </select></label></div>
                                <button className="publish-button" type="submit"
                                        disabled={isSaving}>{isSaving ? 'Се објавува...' : 'Објави термин'}
                                    <span>→</span></button>
                                <p className="form-secure"><span>✓</span>Терминот ќе биде веднаш видлив во распоредот.
                                </p>
                            </form>
                        </div>
                    )}
                </div>
                <div className="privacy-strip"><span className="privacy-icon">✓</span><span><strong>Вашата приватност е важна.</strong> Податоците за резервацијата се користат само за организација на прегледот.</span><span
                    className="privacy-lock">⌑</span></div>
            </section>

            <footer className="site-footer"><a className="brand footer-brand" href="#top"><span
                className="brand-symbol"><span/></span>carepoint<span className="brand-period">.</span></a><span
                className="footer-made">Направено со <b>♥</b></span></footer>

            {selectedSlot && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
                if (event.target === event.currentTarget) setSelectedSlot(null)
            }}>
                <section className="booking-modal" role="dialog" aria-modal="true" aria-labelledby="booking-title">
                    <button className="modal-close" type="button" aria-label="Затвори"
                            onClick={() => setSelectedSlot(null)}>×
                    </button>
                    <span className="modal-icon">✓</span><p className="section-eyebrow">РЕЗЕРВИРАЈ ПРЕГЛЕД</p><h2
                    id="booking-title">Ваши податоци</h2>
                    <div className="selected-slot"><span
                        className="selected-calendar">▦</span><span><strong>{doctors.find((doctor) => doctor.id === selectedSlot.doctorId)?.fullName ?? 'Преглед'}</strong><small>{selectedSlot.startTime} · {selectedSlot.durationMinutes} минути</small></span>
                    </div>
                    <form className="booking-form" onSubmit={handleBooking}><label className="form-field"><span>Име и презиме <b>*</b></span><input
                        required minLength={2} maxLength={100} autoComplete="name" placeholder="Вашето име"
                        value={patientName} onChange={(event) => setPatientName(event.target.value)}/></label><label
                        className="form-field"><span>Email адреса <b>*</b></span><input required type="email"
                                                                                        maxLength={254}
                                                                                        autoComplete="email"
                                                                                        placeholder="ime@example.com"
                                                                                        value={patientEmail}
                                                                                        onChange={(event) => setPatientEmail(event.target.value)}/></label><label
                        className="form-field"><span>Description (опис на симптоми)</span><textarea maxLength={1000}
                                                                                                    rows={3}
                                                                                                    placeholder="Опишете ја причината за прегледот"
                                                                                                    value={description}
                                                                                                    onChange={(event) => setDescription(event.target.value)}/></label>
                        <button className="publish-button modal-submit" type="submit"
                                disabled={isSaving}>{isSaving ? 'Се резервира...' : 'Потврди резервација'}
                            <span>→</span></button>
                        <p className="form-secure"><span>✓</span>Со потврда, терминот ќе биде резервиран за вас.</p>
                    </form>
                </section>
            </div>}
        </div>
    )
}

export default App



