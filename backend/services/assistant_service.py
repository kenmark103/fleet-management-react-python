from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from db.models import (
    AssistantActionLog,
    ChatMessage,
    ChatSession,
    Driver,
    MaintenancePrediction,
    Notification,
    Trip,
    Truck,
    WorkOrder,
)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


SUGGESTIONS = [
    {"label": "Find truck", "prompt": "Find truck by plate number"},
    {"label": "Overdue work orders", "prompt": "Show overdue work orders"},
    {"label": "Driver issues", "prompt": "Summarize driver issues"},
    {"label": "Trip status", "prompt": "What is the status of trip"},
]


async def get_or_create_session(db: AsyncSession, user_id: str, session_id: Optional[str] = None) -> ChatSession:
    if session_id:
        session = await db.get(ChatSession, session_id)
        if session and session.user_id == user_id:
            return session
    session = ChatSession(user_id=user_id, title="Fleet Assistant")
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return session


async def handle_chat(db: AsyncSession, user_id: str, message: str, session_id: Optional[str] = None) -> dict:
    session = await get_or_create_session(db, user_id, session_id)
    db.add(ChatMessage(session_id=session.id, role='user', content=message))
    reply, citations = await _answer_query(db, user_id, message)
    created_at = _utcnow()
    db.add(ChatMessage(session_id=session.id, role='assistant', content=reply, metadata_json={'citations': citations}))
    await db.commit()
    return {
        'session_id': session.id,
        'reply': reply,
        'citations': citations,
        'suggestions': [s['prompt'] for s in SUGGESTIONS[:3]],
        'created_at': created_at,
    }


async def _answer_query(db: AsyncSession, user_id: str, message: str) -> tuple[str, list[str]]:
    lowered = message.lower()

    if 'overdue' in lowered and 'work' in lowered:
        items = (await db.execute(
            select(WorkOrder).where(WorkOrder.status == 'overdue').order_by(WorkOrder.scheduled_date.asc()).limit(5)
        )).scalars().all()
        if not items:
            return ('There are no overdue work orders right now.', ['work_orders'])
        lines = [f"{item.work_order_number}: {item.title}" for item in items]
        return ('Overdue work orders: ' + '; '.join(lines), ['work_orders'])

    if 'truck' in lowered:
        plate_token = next((token.upper() for token in message.split() if any(ch.isdigit() for ch in token)), None)
        q = select(Truck)
        if plate_token:
            q = q.where(Truck.plate_number.ilike(f'%{plate_token}%'))
        truck = (await db.execute(q.order_by(Truck.plate_number.asc()))).scalars().first()
        if truck:
            prediction = (await db.execute(
                select(MaintenancePrediction)
                .where(MaintenancePrediction.truck_id == truck.id)
                .order_by(MaintenancePrediction.generated_at.desc())
                .limit(1)
            )).scalar_one_or_none()
            summary = f"Truck {truck.plate_number} is {truck.status} at {truck.odometer_km:.0f} km."
            if prediction:
                summary += f" Latest prediction: {prediction.recommended_action}."
            return (summary, ['trucks', 'maintenance_predictions'])

    if 'driver' in lowered and 'issue' in lowered:
        drivers = (await db.execute(select(Driver).order_by(Driver.last_name.asc()).limit(5))).scalars().all()
        if not drivers:
            return ('No driver records are available.', ['drivers'])
        names = ', '.join(f'{d.first_name} {d.last_name}' for d in drivers)
        return (f'Drivers on record include {names}. Open the driver scorecards for detailed issues.', ['drivers', 'driver_scorecards'])

    if 'trip' in lowered:
        trips = (await db.execute(select(Trip).order_by(Trip.created_at.desc()).limit(5))).scalars().all()
        if trips:
            latest = trips[0]
            return (f'Latest trip is {latest.trip_number} from {latest.origin} to {latest.destination} and it is {latest.status}.', ['trips'])

    notifications = (await db.execute(select(Notification).where(Notification.user_id == user_id).order_by(Notification.created_at.desc()).limit(3))).scalars().all()
    if notifications:
        summary = '; '.join(n.title for n in notifications)
        return (f'I found recent notifications: {summary}. Try asking about a truck, trip, or overdue work order.', ['notifications'])

    return ('I can help find trucks, summarize trips, list overdue work orders, and point you to driver issues.', ['assistant'])


async def perform_action_query(db: AsyncSession, user_id: str, action: str, target_type: Optional[str], target_id: Optional[str], query: Optional[str]) -> dict:
    result_text = 'No matching action result.'
    items: list[dict] = []

    if action == 'find' and target_type == 'truck' and query:
        trucks = (await db.execute(select(Truck).where(or_(Truck.plate_number.ilike(f'%{query}%'), Truck.make.ilike(f'%{query}%'))).limit(10))).scalars().all()
        items = [{'id': t.id, 'plateNumber': t.plate_number, 'status': t.status} for t in trucks]
        result_text = f'Found {len(items)} truck(s).'
    elif action == 'list' and target_type == 'work_order':
        orders = (await db.execute(select(WorkOrder).where(WorkOrder.status == 'overdue').limit(10))).scalars().all()
        items = [{'id': w.id, 'workOrderNumber': w.work_order_number, 'title': w.title, 'status': w.status} for w in orders]
        result_text = f'Found {len(items)} overdue work order(s).'
    elif action == 'find' and target_type == 'trip' and query:
        trips = (await db.execute(select(Trip).where(Trip.trip_number.ilike(f'%{query}%')).limit(10))).scalars().all()
        items = [{'id': t.id, 'tripNumber': t.trip_number, 'status': t.status} for t in trips]
        result_text = f'Found {len(items)} trip(s).'

    db.add(AssistantActionLog(
        user_id=user_id,
        tool_name=action,
        target_type=target_type,
        target_id=target_id,
        result_text=result_text,
    ))
    await db.commit()

    return {'action': action, 'result': result_text, 'items': items, 'created_at': _utcnow()}
