<?php

namespace App\Enums;

enum SalesLeadStatus: string
{
    case New = 'new';
    case Contacted = 'contacted';
    case Qualified = 'qualified';
    case Rejected = 'rejected';
    case Excluded = 'excluded';
}
