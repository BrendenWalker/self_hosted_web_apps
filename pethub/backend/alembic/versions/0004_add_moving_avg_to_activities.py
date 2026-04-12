"""add moving_avg to activities

Revision ID: 0004_add_moving_avg_to_activities
Revises: 0003_add_admin_birthdate_settings
Create Date: 2025-01-15 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import text
from datetime import datetime, timezone
from collections import defaultdict

revision = '0004_add_moving_avg_to_activities'
down_revision = '0003_add_admin_birthdate_settings'
branch_labels = None
depends_on = None


def calculate_moving_avg_for_activity(conn, pet_id, sub_type, created_at):
    """Calculate moving average for a specific activity using raw SQL"""
    if not pet_id or not sub_type:
        return None
    
    # Get all toilet events for this pet and sub_type up to and including this activity
    query = text("""
        SELECT created_at 
        FROM activities 
        WHERE pet_id = :pet_id 
          AND activity_type = 'toilet' 
          AND sub_type = :sub_type
          AND created_at <= :created_at
        ORDER BY created_at ASC
    """)
    
    result = conn.execute(query, {
        'pet_id': pet_id,
        'sub_type': sub_type,
        'created_at': created_at
    })
    events = [row[0] for row in result]
    
    if len(events) < 2:
        return None
    
    # Normalize all events to UTC (assuming they're stored as UTC)
    normalized_events = []
    for event in events:
        if isinstance(event, datetime):
            if event.tzinfo is None:
                normalized_events.append(event.replace(tzinfo=timezone.utc))
            else:
                normalized_events.append(event.astimezone(timezone.utc))
        else:
            normalized_events.append(event)
    
    # Group events by day
    daily_events = defaultdict(list)
    for event in sorted(normalized_events):
        day = event.date()
        daily_events[day].append(event)
    
    # Calculate intervals per day
    intervals_by_day = {}
    for day in sorted(daily_events.keys()):
        day_events = sorted(daily_events[day])
        if len(day_events) > 1:
            day_intervals = []
            for i in range(1, len(day_events)):
                delta = (day_events[i] - day_events[i-1]).total_seconds() / 3600.0
                day_intervals.append(delta)
            if day_intervals:
                intervals_by_day[day] = sum(day_intervals) / len(day_intervals)
    
    if not intervals_by_day:
        return None
    
    # For the current day, calculate weighted moving average using last 7 days
    sorted_days = sorted(intervals_by_day.keys())
    current_day = normalized_events[-1].date()
    
    # Find the index of the current day
    current_idx = None
    for i, day in enumerate(sorted_days):
        if day <= current_day:
            current_idx = i
        else:
            break
    
    if current_idx is None:
        current_idx = 0
    
    # Look back up to 7 days
    window_days = []
    for j in range(max(0, current_idx - 6), current_idx + 1):
        day = sorted_days[j]
        if day in intervals_by_day:
            window_days.append((day, intervals_by_day[day]))
    
    if len(window_days) < 2:
        return None
    
    # Use equal weights
    total_weight = len(window_days)
    weighted_sum = sum(interval for _, interval in window_days)
    
    return round(weighted_sum / total_weight, 1) if total_weight > 0 else None


def upgrade():
    # Add moving_avg column to activities (idempotent)
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'activities' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('activities')]
        column_exists = 'moving_avg' in columns
        
        if not column_exists:
            op.add_column('activities', sa.Column('moving_avg', sa.Float(), nullable=True))
        
        # Backfill moving_avg for existing toilet activities
        # This runs whether the column was just added or already existed (to backfill NULL values)
        print("Starting backfill of moving_avg for existing toilet activities...")
        
        try:
            # Get all toilet activities ordered by created_at
            query = text("""
                SELECT id, pet_id, sub_type, created_at 
                FROM activities 
                WHERE activity_type = 'toilet' 
                  AND sub_type IN ('poop', 'pee')
                  AND pet_id IS NOT NULL
                  AND moving_avg IS NULL
                ORDER BY pet_id, sub_type, created_at ASC
            """)
            
            result = conn.execute(query)
            activities = result.fetchall()
            
            print(f"Found {len(activities)} activities with NULL moving_avg to backfill")
            
            if len(activities) == 0:
                # Check if there are any toilet activities at all
                check_query = text("""
                    SELECT COUNT(*) 
                    FROM activities 
                    WHERE activity_type = 'toilet' 
                      AND sub_type IN ('poop', 'pee')
                      AND pet_id IS NOT NULL
                """)
                total_count = conn.execute(check_query).scalar()
                print(f"Total toilet activities in database: {total_count}")
                
                # Check how many already have moving_avg
                if total_count > 0:
                    filled_query = text("""
                        SELECT COUNT(*) 
                        FROM activities 
                        WHERE activity_type = 'toilet' 
                          AND sub_type IN ('poop', 'pee')
                          AND pet_id IS NOT NULL
                          AND moving_avg IS NOT NULL
                    """)
                    filled_count = conn.execute(filled_query).scalar()
                    print(f"Activities with moving_avg already set: {filled_count}")
            
            # Update each activity with its moving average
            update_query = text("""
                UPDATE activities 
                SET moving_avg = :moving_avg 
                WHERE id = :activity_id
            """)
            
            updated_count = 0
            skipped_count = 0
            error_count = 0
            
            for i, (activity_id, pet_id, sub_type, created_at) in enumerate(activities, 1):
                if i % 100 == 0:
                    print(f"Processing {i}/{len(activities)}...")
                
                try:
                    moving_avg = calculate_moving_avg_for_activity(conn, pet_id, sub_type, created_at)
                    if moving_avg is not None:
                        conn.execute(update_query, {
                            'moving_avg': moving_avg,
                            'activity_id': activity_id
                        })
                        updated_count += 1
                    else:
                        skipped_count += 1
                except Exception as e:
                    error_count += 1
                    print(f"Error calculating moving_avg for activity {activity_id}: {e}")
                    # Continue with next activity
            
            # Note: Alembic manages the transaction, no explicit commit needed
            print(f"Backfill complete: Updated {updated_count}, Skipped {skipped_count}, Errors {error_count}")
            
        except Exception as e:
            print(f"Error during backfill: {e}")
            import traceback
            traceback.print_exc()
            # Don't fail the migration if backfill fails


def downgrade():
    # Remove moving_avg from activities
    conn = op.get_bind()
    inspector = sa.inspect(conn)
    if 'activities' in inspector.get_table_names():
        columns = [col['name'] for col in inspector.get_columns('activities')]
        if 'moving_avg' in columns:
            op.drop_column('activities', 'moving_avg')

