<?php

namespace App\Enums;

enum JobStatus: string
{
    case Draft = 'draft';
    case PendingReview = 'pending_review';
    case Scheduled = 'scheduled';
    case Active = 'active';
    case Suspended = 'suspended';
    case Closed = 'closed';
}